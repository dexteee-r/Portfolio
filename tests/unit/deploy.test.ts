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
 * CI, and the deployment on the homelab's own runner. The shell scripts run
 * for real, against fake `docker`, `curl` and `flock`.
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
const deployment = workflow("deploy.yml");

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
    vi.stubEnv("ELMZN_VERSION", "abc123");
    expect(await nextConfig.headers!()).toEqual([
      { source: "/:path*", headers: [{ key: "X-Elmzn-Version", value: "abc123" }] },
    ]);
    vi.stubEnv("ELMZN_VERSION", "");
    expect(await nextConfig.headers!()).toEqual([]);
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

  it("catches up hourly on a missed deployment, through the same script", () => {
    expect(read("deploy/elmzn-deploy.service")).toContain("ExecStart=/opt/elmzn/deploy.sh");
    expect(read("deploy/elmzn-deploy.timer")).toContain("OnUnitActiveSec=1h");
  });

  it("opens nothing to the internet but the site: no webhook, no deployment endpoint", () => {
    expect(Object.keys(parse(read("deploy/compose.yaml")).services)).toEqual(["web"]);
    expect(existsSync(join(ROOT, "deploy", "hooks.json"))).toBe(false);
    expect(existsSync(join(ROOT, "deploy", "notify.sh"))).toBe(false);
  });
});

describe("the deployment, on the homelab's own runner", () => {
  const job = deployment.jobs.deploy!;

  it("starts only when CI has finished a run on main", () => {
    expect(deployment.on).toEqual({ workflow_run: { workflows: ["CI"], types: ["completed"], branches: ["main"] } });
  });

  it("runs only for a successful CI run of a push to main of this repository — never a pull request, never a fork", () => {
    const guard = job.if!.replace(/\s+/g, " ");
    expect(guard).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(guard).toContain("github.event.workflow_run.event == 'push'");
    expect(guard).toContain("github.event.workflow_run.head_branch == 'main'");
    // A fork's own branch may well be called main, too.
    expect(guard).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    expect(guard.match(/&&/g)).toHaveLength(4); // all five, not any of them
    expect(guard).not.toContain("||");
  });

  it("is skipped, not left queued, until the homelab's runner is registered", () => {
    expect(job.if!.trim().startsWith("vars.DEPLOY_ON_HOMELAB == 'true' &&")).toBe(true);
  });

  it("holds no token, and checks nothing out: no code from the repository runs on the runner", () => {
    expect(deployment.permissions).toEqual({});
    expect(job.permissions).toBeUndefined();
    expect(job.steps.every((step) => step.uses === undefined)).toBe(true);
    expect(JSON.stringify(deployment)).not.toMatch(/secrets\./);
  });

  it("asks the server to pull the published image, then checks the site serves this very commit", () => {
    expect(job["runs-on"]).toEqual(["self-hosted", "portfolio"]);
    expect(job.steps.map((step) => step.run)).toEqual([
      "/opt/elmzn/deploy.sh",
      '/opt/elmzn/wait-for-version.sh http://127.0.0.1:3000/fr "$SHA" 120',
    ]);
    // The commit comes through the environment, never pasted into a script.
    expect(job.env).toEqual({ SHA: "${{ github.event.workflow_run.head_sha }}" });
    for (const step of job.steps) expect(step.run).not.toContain("${{");
  });

  it("deploys one at a time, never cutting a deployment short", () => {
    expect(deployment.concurrency).toEqual({ group: "deploy", "cancel-in-progress": false });
  });

  it("is the only workflow that may reach the self-hosted runner", () => {
    for (const file of readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name))) {
      for (const [name, other] of Object.entries(workflow(file).jobs)) {
        const labels = [other["runs-on"] ?? []].flat();
        if (file === "deploy.yml") continue;
        expect(labels, `${file} › ${name}`).not.toContain("self-hosted");
        expect(labels, `${file} › ${name}`).not.toContain("portfolio");
      }
    }
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

  it("leaves deploying to the homelab's runner, and needs no deployment secret", () => {
    expect(Object.keys(ci.jobs)).toEqual(["check", "image"]);
    expect(read(".github/workflows/ci.yml")).not.toMatch(/DEPLOY_|self-hosted/);
    // deploy.yml follows CI by its name.
    expect(read(".github/workflows/ci.yml")).toMatch(/^name: CI$/m);
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
  it("pulls, restarts only if needed and waits until healthy, then prunes this site's old images", () => {
    const fake = fakes({ docker: "exit 0", flock: "exit 0" });
    const result = run("deploy/deploy.sh", [], fake.dir);
    expect(result.status, result.stderr).toBe(0);
    expect(fake.calls()).toEqual([
      "flock 9",
      "docker compose pull --quiet web",
      "docker compose up --detach --wait --wait-timeout 120 web",
      "docker image prune --force --filter label=org.opencontainers.image.source=https://github.com/dexteee-r/Portfolio",
    ]);
  });

  it("locks on itself, read-only: the runner's user and the timer's root share one lock", () => {
    const script = read("deploy/deploy.sh");
    expect(script).toContain('exec 9<"$0"');
    expect(script).not.toMatch(/exec 9>/); // a lock file root created first would shut the runner out
  });

  it("stops at the first failure — a new image that never gets healthy is reported", () => {
    const fake = fakes({
      docker: 'case "$*" in *"up "*) echo "container unhealthy" >&2; exit 1 ;; esac',
      flock: "exit 0",
    });
    const result = run("deploy/deploy.sh", [], fake.dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("container unhealthy");
    expect(fake.calls().some((call) => call.includes("prune"))).toBe(false);
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
