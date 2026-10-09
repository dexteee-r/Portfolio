// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import nextConfig from "../../next.config";

/**
 * The way the site reaches the homelab: the image, how the server runs it,
 * CI, and the deployment — the server pulling the published image on its own
 * timer, with no runner and nothing from GitHub executed on it. The shell
 * scripts run for real, against fake `docker`, `curl` and `flock`.
 */

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const IMAGE = "ghcr.io/dexteee-r/portfolio";
const WORKFLOWS = join(ROOT, ".github", "workflows");

interface Step {
  name?: string;
  run?: string;
  if?: string;
  uses?: string;
}
interface Job {
  needs?: string | string[];
  if?: string;
  "runs-on"?: string | string[];
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  steps: Step[];
}
interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  concurrency?: { group: string; "cancel-in-progress": boolean };
  jobs: Record<string, Job>;
}
const workflow = (file: string) => parse(readFileSync(join(WORKFLOWS, file), "utf8")) as Workflow;
const ci = workflow("ci.yml");
const workflowFiles = readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name));

describe("the image", () => {
  const dockerfile = read("Dockerfile");
  const runtime = dockerfile.slice(dockerfile.lastIndexOf("FROM "));

  it("uses the Node version CI tests with", () => {
    const node = ci.jobs.check!.steps.find((s) => s.uses?.startsWith("actions/setup-node")) as Step & {
      with: { "node-version": number };
    };
    expect(dockerfile).toContain(`ARG NODE_VERSION=${node.with["node-version"]}`);
  });

  it("runs the standalone server as an unprivileged user, and says when it is healthy", () => {
    expect(runtime).toMatch(/^USER node$/m);
    expect(runtime).toContain('CMD ["node", "server.js"]');
    expect(runtime).toMatch(/HEALTHCHECK[\s\S]*127\.0\.0\.1:3000\/fr/);
    expect(runtime).toContain("NODE_ENV=production");
  });

  it("leaves the app's files to root: the server can only write its cache", () => {
    expect(runtime).not.toMatch(/COPY --chown/);
    expect(runtime).toContain("chown node:node .next/cache");
  });

  it("never holds a secret: the CMS settings come from the server at run time", () => {
    expect(dockerfile).not.toMatch(/CMS_GITHUB|SECRET|TOKEN/);
  });

  it("is labelled with its source, so the server can prune only its own old images", () => {
    expect(runtime).toContain('org.opencontainers.image.source="https://github.com/dexteee-r/Portfolio"');
    expect(read("deploy/deploy.sh")).toContain("label=org.opencontainers.image.source=https://github.com/dexteee-r/Portfolio");
  });

  it("is built from a context without secrets, tests or build leftovers", () => {
    const ignored = read(".dockerignore").split("\n").map((line) => line.trim());
    for (const entry of [".env", ".env.*", ".git", "node_modules", ".next", ".next-e2e", "tests", "public/media/fixtures"]) {
      expect(ignored, entry).toContain(entry);
    }
  });

  it("comes from a standalone build that says which commit it is", async () => {
    expect(process.env.NEXT_DIST_DIR).toBeUndefined(); // a production build, as in the Dockerfile
    expect(nextConfig.output).toBe("standalone");
    const version = async () =>
      (await nextConfig.headers!()).flatMap((rule) => rule.headers).find((header) => header.key === "X-Elmzn-Version");
    vi.stubEnv("ELMZN_VERSION", "abc123");
    expect(await version()).toEqual({ key: "X-Elmzn-Version", value: "abc123" });
    vi.stubEnv("ELMZN_VERSION", "");
    expect(await version()).toBeUndefined();
    vi.unstubAllEnvs();
  });
});

describe("the server", () => {
  const compose = parse(read("deploy/compose.yaml")) as {
    services: { web: Record<string, unknown> };
  };
  const web = compose.services.web;

  it("runs the published image, restarted with the machine", () => {
    expect(web.image).toBe(`${IMAGE}:latest`);
    expect(web.restart).toBe("unless-stopped");
    expect(web.ports).toEqual(["3000:3000"]);
  });

  it("keeps the secrets in a .env beside it", () => {
    expect(web.env_file).toBe(".env");
    expect(read(".gitignore")).toMatch(/^\.env$/m);
  });

  it("locks the container down: read-only, no capabilities, no privilege escalation", () => {
    expect(web.read_only).toBe(true);
    // The image cache belongs to the user the server runs as (node, uid 1000), or it cannot write it.
    expect(web.tmpfs).toEqual(["/app/.next/cache:uid=1000,gid=1000", "/tmp"]);
    expect(read("deploy/smoke-test.sh")).toContain("--tmpfs /app/.next/cache:uid=1000,gid=1000");
    expect(web.cap_drop).toEqual(["ALL"]);
    expect(web.security_opt).toEqual(["no-new-privileges:true"]);
  });

  it("caps the size of its logs", () => {
    expect(web.logging).toEqual({ driver: "json-file", options: { "max-size": "10m", "max-file": "3" } });
  });

  it("looks for a newly published image every two minutes, on its own timer", () => {
    const service = read("deploy/elmzn-deploy.service");
    expect(service).toContain("ExecStart=/opt/elmzn/deploy.sh");
    expect(service).toContain("Type=oneshot");
    expect(service).toMatch(/^TimeoutStartSec=/m);
    const timer = read("deploy/elmzn-deploy.timer");
    expect(timer).toContain("OnUnitActiveSec=2min");
    expect(timer).toContain("OnBootSec=1min");
    expect(timer).toContain("WantedBy=timers.target");
  });

  it("pulls the very image it runs", () => {
    expect(read("deploy/deploy.sh")).toContain(`image=${web.image}`);
  });

  it("opens nothing to the internet but the site: no webhook, no deployment endpoint", () => {
    expect(Object.keys(parse(read("deploy/compose.yaml")).services)).toEqual(["web"]);
    expect(existsSync(join(ROOT, "deploy", "hooks.json"))).toBe(false);
    expect(existsSync(join(ROOT, "deploy", "notify.sh"))).toBe(false);
  });
});

describe("no runner on the homelab", () => {
  // The repository is public: a self-hosted runner is one approved pull request
  // away from running a stranger's code on the server (2026-10-08 audit).

  it("no workflow runs on a self-hosted runner", () => {
    for (const file of workflowFiles) {
      for (const [name, job] of Object.entries(workflow(file).jobs)) {
        const labels = [job["runs-on"] ?? []].flat();
        expect(labels, `${file} › ${name}`).not.toContain("self-hosted");
        expect(labels, `${file} › ${name}`).not.toContain("portfolio");
        expect(String(job["runs-on"]), `${file} › ${name}`).toMatch(/^ubuntu-/);
      }
    }
  });

  it("no workflow deploys: the old runner workflow is gone, and nothing follows CI", () => {
    expect(workflowFiles).toEqual(["ci.yml"]);
    for (const file of workflowFiles) expect(read(`.github/workflows/${file}`)).not.toMatch(/workflow_run|DEPLOY_ON_HOMELAB/);
  });
});

describe("CI", () => {
  const { image } = ci.jobs;

  it("gives every job read-only access by default", () => {
    expect(ci.permissions).toEqual({ contents: "read" });
  });

  it("builds an image only from main, and only once every check has passed", () => {
    expect(image!.needs).toBe("check");
    expect(image!.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/main'");
    expect(image!.permissions).toEqual({ contents: "read", packages: "write" });
    const runs = image!.steps.map((s) => s.run ?? "").join("\n");
    expect(runs).toContain("--build-arg ELMZN_VERSION=${{ github.sha }}");
    // Smoke-tested before it is published, never after.
    expect(runs.indexOf("deploy/smoke-test.sh")).toBeLessThan(runs.indexOf("docker push"));
  });

  it("leaves deploying to the server, and needs no deployment secret", () => {
    expect(Object.keys(ci.jobs)).toEqual(["check", "image"]);
    expect(read(".github/workflows/ci.yml")).not.toMatch(/DEPLOY_|self-hosted|ssh /);
  });
});

// ---------------------------------------------------------------------------
// The scripts, run for real.

const SH = ["sh", "/bin/sh"].find((candidate) => spawnSync(candidate, ["-c", "exit 0"]).status === 0);
const temporary: string[] = [];

afterEach(() => {
  for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A folder of fake commands, each logging its arguments to `calls`, one call per line. */
function fakes(commands: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "elmzn-deploy-"));
  temporary.push(dir);
  const calls = join(dir, "calls.log").replace(/\\/g, "/");
  writeFileSync(calls, "");
  for (const [name, body] of Object.entries(commands)) {
    writeFileSync(join(dir, name), `#!/bin/sh\necho "${name} $*" >> "${calls}"\n${body}\n`, { mode: 0o755 });
  }
  return { dir, calls: () => readFileSync(calls, "utf8").trim().split("\n").filter(Boolean) };
}

function run(script: string, args: string[], bin: string, env: Record<string, string> = {}) {
  return spawnSync(SH!, [join(ROOT, script).replace(/\\/g, "/"), ...args], {
    env: { ...process.env, ...env, PATH: `${bin}${delimiter}${process.env.PATH}` },
    encoding: "utf8",
  });
}

describe.skipIf(!SH)("deploy.sh", () => {
  const PRUNE =
    "docker image prune --force --filter label=org.opencontainers.image.source=https://github.com/dexteee-r/Portfolio";

  /**
   * A server with an image `local` (none if empty), a registry offering
   * `published`, built from commit `version`; the site serves `served`.
   * `docker compose up` fails if `unhealthy`; the lock is taken if `busy`.
   */
  function server({
    local = "sha256:old",
    published = "sha256:old",
    version = "abc123",
    served = "abc123",
    unhealthy = false,
    busy = false,
  } = {}) {
    const fake = fakes({
      docker: [
        'here=$(dirname "$0")',
        'case "$*" in',
        '  "image inspect --format {{.Id}} "*) cat "$here/local" 2>/dev/null || exit 1 ;;',
        `  "image inspect --format {{range"*) printf 'PATH=/usr/bin\\nELMZN_VERSION=%s\\n' "${version}" ;;`,
        `  "compose pull --quiet web") echo "${published}" > "$here/local" ;;`,
        `  "compose up "*) ${unhealthy ? 'echo "container unhealthy" >&2; exit 1' : "exit 0"} ;;`,
        "esac",
      ].join("\n"),
      curl: [
        'case "$*" in',
        `  *--head*) printf 'HTTP/1.1 200 OK\\r\\nX-Elmzn-Version: %s\\r\\n\\r\\n' "${served}" ;;`,
        "  *sitemap.xml) echo '<urlset></urlset>' ;;",
        "esac",
      ].join("\n"),
      flock: busy ? "exit 1" : "exit 0",
    });
    if (local) writeFileSync(join(fake.dir, "local"), `${local}\n`);
    return fake;
  }

  const deploy = (fake: ReturnType<typeof server>) =>
    run("deploy/deploy.sh", [], fake.dir, { POLL_SECONDS: "0", VERSION_TIMEOUT: "1" });

  it("with no new image: checks the site is up, touches nothing else, says nothing", () => {
    const fake = server();
    const result = deploy(fake);
    expect(result.status, result.stderr).toBe(0);
    expect(fake.calls()).toEqual([
      "flock -n 9",
      "docker image inspect --format {{.Id}} ghcr.io/dexteee-r/portfolio:latest",
      "docker compose pull --quiet web",
      "docker image inspect --format {{.Id}} ghcr.io/dexteee-r/portfolio:latest",
      "docker compose up --detach --wait --wait-timeout 120 web",
    ]);
    expect(result.stdout).toBe("");
  });

  it("with a new image: restarts on it, checks the site serves its commit, prunes old images, warms the cache", () => {
    const fake = server({ published: "sha256:new" });
    const result = deploy(fake);
    expect(result.status, result.stderr).toBe(0);
    const calls = fake.calls();
    const at = (prefix: string) => calls.findIndex((call) => call.startsWith(prefix));
    expect(at("docker compose up")).toBeGreaterThan(at("docker compose pull"));
    expect(at("curl --silent --max-time 10 --head http://127.0.0.1:3000/fr")).toBeGreaterThan(at("docker compose up"));
    expect(at(PRUNE)).toBeGreaterThan(at("curl --silent --max-time 10 --head"));
    expect(at("curl --silent --fail --max-time 30 http://127.0.0.1:3000/sitemap.xml")).toBeGreaterThan(at(PRUNE));
    expect(result.stdout).toContain("Live: http://127.0.0.1:3000/fr serves abc123");
    expect(result.stdout).toContain("image cache warmed");
    expect(result.stdout).toContain("elmzn: deployed abc123");
  });

  it("on a fresh server, with no image yet: deploys the published one", () => {
    const fake = server({ local: "", published: "sha256:new" });
    const result = deploy(fake);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("elmzn: deployed abc123");
  });

  it("fails, and keeps the old images, when a new image never gets healthy", () => {
    const fake = server({ published: "sha256:new", unhealthy: true });
    const result = deploy(fake);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("container unhealthy");
    expect(fake.calls()).not.toContain(PRUNE);
  });

  it("fails, and keeps the old images, when the site never serves the new image's commit", () => {
    const fake = server({ published: "sha256:new", served: "older" });
    const result = deploy(fake);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Still serving 'older' instead of abc123");
    expect(fake.calls()).not.toContain(PRUNE);
  });

  it("steps aside while a previous run still holds the lock", () => {
    const fake = server({ published: "sha256:new", busy: true });
    const result = deploy(fake);
    expect(result.status).toBe(0);
    expect(fake.calls()).toEqual(["flock -n 9"]);
  });

  it("locks on itself, read-only, without waiting", () => {
    const script = read("deploy/deploy.sh");
    expect(script).toContain('exec 9<"$0"');
    expect(script).toContain("flock -n 9 || exit 0");
    expect(script).not.toMatch(/exec 9>/);
  });
});

describe.skipIf(!SH)("warm-cache.sh", () => {
  const IMAGE_A = "/_next/image?url=%2Fmedia%2Fa.webp";
  const page = [
    `<img srcSet="${IMAGE_A}&amp;w=640&amp;q=75 640w, ${IMAGE_A}&amp;w=1080&amp;q=75 1080w" src="${IMAGE_A}&amp;w=1080&amp;q=75"/>`,
    // The page's React payload repeats the same URLs, escaped.
    `<script>self.__next_f.push([1,"\\"srcSet\\":\\"${IMAGE_A}\\u0026w=640\\u0026q=75 640w\\""])</script>`,
  ].join("\n");
  const sitemap = "<urlset><url><loc>https://elmzn.be/fr</loc></url><url><loc>https://elmzn.be/en/dev</loc></url></urlset>";

  /** A site answering from files beside the fake curl; `failing` makes the images it matches fail, `down` the whole site. */
  function site({ down = false, failing = "" } = {}) {
    const fake = fakes({
      curl: [
        "for last; do :; done",
        'here=$(dirname "$0")',
        'case "$last" in',
        `  */sitemap.xml) ${down ? "exit 22" : 'cat "$here/sitemap.xml"'} ;;`,
        `  */_next/image*) case "$last" in *"${failing || "never"}"*) exit 22 ;; esac ;;`,
        '  *) cat "$here/page.html" ;;',
        "esac",
      ].join("\n"),
    });
    writeFileSync(join(fake.dir, "sitemap.xml"), sitemap);
    writeFileSync(join(fake.dir, "page.html"), page);
    return fake;
  }

  it("asks the site, locally, for every image of every page in its sitemap — once each, never their escaped copies", () => {
    const fake = site();
    const result = run("deploy/warm-cache.sh", [], fake.dir);
    expect(result.status, result.stderr).toBe(0);
    const calls = fake.calls();
    expect(calls[0]).toBe("curl --silent --fail --max-time 30 http://127.0.0.1:3000/sitemap.xml");
    expect(calls.slice(1, 3)).toEqual([
      "curl --silent --fail --max-time 30 http://127.0.0.1:3000/fr",
      "curl --silent --fail --max-time 30 http://127.0.0.1:3000/en/dev",
    ]);
    const images = calls.filter((call) => call.includes("/_next/image"));
    expect(images).toEqual([
      `curl --silent --fail --max-time 60 --output /dev/null --header Accept: image/avif,image/webp,*/* http://127.0.0.1:3000${IMAGE_A}&w=1080&q=75`,
      `curl --silent --fail --max-time 60 --output /dev/null --header Accept: image/avif,image/webp,*/* http://127.0.0.1:3000${IMAGE_A}&w=640&q=75`,
    ]);
    expect(result.stdout).toMatch(/image cache warmed — 2 ok, 0 failed, from 2 pages, in \d+s/);
  });

  it("counts an image that does not answer, skips it, and still lets the deployment succeed", () => {
    const result = run("deploy/warm-cache.sh", ["http://127.0.0.1:3000"], site({ failing: "w=1080" }).dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 ok, 1 failed");
  });

  it("never fails a deployment: with the site unreachable, says so and stops", () => {
    const fake = site({ down: true });
    const result = run("deploy/warm-cache.sh", [], fake.dir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("sitemap unreachable");
    expect(fake.calls().some((call) => call.includes("/_next/image"))).toBe(false);
  });
});

describe.skipIf(!SH)("wait-for-version.sh", () => {
  /** A site that serves `before` for the first `after` requests, then `now`. */
  function site(before: string, now: string, after: number) {
    return fakes({
      curl: [
        'count_file="$(dirname "$0")/count"',
        'n=$(cat "$count_file" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "$count_file"',
        `if [ "$n" -le ${after} ]; then v=${before}; else v=${now}; fi`,
        'printf "HTTP/1.1 200 OK\\r\\nX-Elmzn-Version: %s\\r\\n\\r\\n" "$v"',
      ].join("\n"),
    });
  }

  it("returns as soon as the site serves the new version", () => {
    const fake = site("old", "new", 2);
    const result = run("deploy/wait-for-version.sh", ["https://elmzn.be/fr", "new", "30"], fake.dir, { POLL_SECONDS: "0" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("serves new");
    expect(fake.calls()).toHaveLength(3);
  });

  it("fails, saying what is served, when the new version never shows up", () => {
    const fake = site("old", "old", 0);
    const result = run("deploy/wait-for-version.sh", ["https://elmzn.be/fr", "new", "1"], fake.dir, { POLL_SECONDS: "0" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Still serving 'old' instead of new");
  });
});
