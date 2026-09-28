// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import nextConfig from "../../next.config";

/**
 * The way the site reaches the homelab: the image, how the server runs it,
 * the signed webhook and the CI jobs that tie them together. The shell
 * scripts run for real, against fake `docker`, `curl` and `flock`.
 */

const ROOT = join(__dirname, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const IMAGE = "ghcr.io/dexteee-r/portfolio";

interface Step {
  name?: string;
  run?: string;
  if?: string;
  uses?: string;
}
interface Job {
  needs?: string | string[];
  if?: string;
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  steps: Step[];
}
const ci = parse(read(".github/workflows/ci.yml")) as {
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
};

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

  it("catches up hourly on a missed webhook, through the same script", () => {
    expect(read("deploy/elmzn-deploy.service")).toContain("ExecStart=/opt/elmzn/deploy.sh");
    expect(read("deploy/elmzn-deploy.timer")).toContain("OnUnitActiveSec=1h");
  });
});

describe("the webhook", () => {
  const [hook, ...others] = JSON.parse(read("deploy/hooks.json")) as Array<Record<string, unknown>>;

  it("defines a single hook that runs the deploy script, on POST only", () => {
    expect(others).toEqual([]);
    expect(hook).toMatchObject({
      id: "elmzn",
      "execute-command": "/opt/elmzn/deploy.sh",
      "http-methods": ["POST"],
      "trigger-rule-mismatch-http-response-code": 403,
    });
  });

  it("only fires on a request signed with the shared secret", () => {
    expect(hook!["trigger-rule"]).toEqual({
      match: {
        type: "payload-hmac-sha256",
        secret: "REPLACE_WITH_DEPLOY_WEBHOOK_SECRET",
        parameter: { source: "header", name: "X-Hub-Signature-256" },
      },
    });
  });

  it("passes nothing from the request to the script", () => {
    expect(hook).not.toHaveProperty("pass-arguments-to-command");
    expect(hook).not.toHaveProperty("pass-environment-to-command");
    expect(hook).not.toHaveProperty("include-command-output-in-response");
  });
});

describe("CI", () => {
  const { image, deploy } = ci.jobs;

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

  it("deploys what it just published, then checks the site really serves it", () => {
    expect(deploy!.needs).toBe("image");
    expect(deploy!.permissions).toBeUndefined();
    const runs = deploy!.steps.map((s) => s.run ?? "").join("\n");
    expect(runs).toContain('deploy/notify.sh "$DEPLOY_WEBHOOK_URL" "${{ github.sha }}"');
    expect(runs).toContain('deploy/wait-for-version.sh "$SITE_URL/fr" "${{ github.sha }}"');
  });

  it("keeps the webhook secret out of the command line and the logs", () => {
    expect(deploy!.env!.DEPLOY_WEBHOOK_SECRET).toBe("${{ secrets.DEPLOY_WEBHOOK_SECRET }}");
    const runs = deploy!.steps.map((s) => s.run ?? "").join("\n");
    expect(runs).not.toMatch(/SECRET/);
  });

  it("skips the deployment, green, until the server is set up", () => {
    const guarded = deploy!.steps.filter((s) => s.run?.includes("deploy/"));
    for (const step of guarded) expect(step.if).toContain("env.DEPLOY_WEBHOOK_URL != ''");
  });
});

// ---------------------------------------------------------------------------
// The scripts, run for real.

const SH = ["sh", "/bin/sh"].find((candidate) => spawnSync(candidate, ["-c", "exit 0"]).status === 0);
const HAS_OPENSSL = SH !== undefined && spawnSync(SH, ["-c", "command -v openssl"]).status === 0;
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

describe.skipIf(!HAS_OPENSSL)("notify.sh", () => {
  const SECRET = "test-webhook-secret";
  const SHA = "0123456789abcdef0123456789abcdef01234567";

  it("sends a request signed exactly as the webhook checks it (HMAC-SHA256 of the body)", () => {
    const fake = fakes({ curl: 'for arg in "$@"; do echo "arg: $arg" >> "$(dirname "$0")/args.log"; done' });
    const result = run("deploy/notify.sh", ["https://deploy.example/hooks/elmzn", SHA], fake.dir, {
      DEPLOY_WEBHOOK_SECRET: SECRET,
    });
    expect(result.status, result.stderr).toBe(0);

    const args = readFileSync(join(fake.dir, "args.log"), "utf8").split("\n").map((l) => l.replace(/^arg: /, ""));
    const body = args[args.indexOf("--data") + 1]!;
    expect(JSON.parse(body)).toEqual({ sha: SHA });
    const signature = args.find((a) => a.startsWith("X-Hub-Signature-256: "))!;
    expect(signature).toBe(`X-Hub-Signature-256: sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`);
    expect(args).toContain("https://deploy.example/hooks/elmzn");
    expect(args.join(" ")).not.toContain(SECRET);
  });

  it("refuses to run without the secret, or with something that is not a commit", () => {
    const fake = fakes({ curl: "exit 0" });
    expect(run("deploy/notify.sh", ["https://x", SHA], fake.dir, { DEPLOY_WEBHOOK_SECRET: "" }).status).not.toBe(0);
    expect(run("deploy/notify.sh", ["https://x", "$(reboot)"], fake.dir, { DEPLOY_WEBHOOK_SECRET: SECRET }).status).toBe(2);
    expect(fake.calls()).toEqual([]);
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
