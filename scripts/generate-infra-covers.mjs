// Draws the covers of the infra chapter's projects: the infra does not
// photograph, so its stations get drawings in the chapter's own grade
// (inventaire-contenu.md, "l'infra ne se photographie pas"). Every fact on
// them comes from the homelab's documentation (github.com/dexteee-r/elmzn_homelab);
// the monitoring panels are an illustration, with no figure on them.
//
// Run, check, commit the result: node scripts/generate-infra-covers.mjs
// Needs the Playwright browser (npx playwright install chromium) and a
// network connection for the DM Mono font.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const sharp = require("sharp");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WIDTH = 1600;
export const HEIGHT = 1000;

/** The infra grade, read from tokens.css: one source of truth for colours. */
const tokens = readFileSync(path.join(root, "src", "styles", "tokens.css"), "utf8");
const token = (name) => {
  const match = new RegExp(`--infra-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(tokens);
  if (!match) throw new Error(`--infra-${name} is not in tokens.css`);
  return match[1];
};
const C = { bg: token("bg"), surface: token("surface"), ink: token("ink"), muted: token("muted"), accent: token("accent"), line: token("line") };
const MONO = "'DM Mono', monospace";

/** Corner brackets around a box, as the network map holds its nodes. */
function brackets(x, y, w, h, arm = 26, width = 3) {
  const corner = (cx, cy, sx, sy) =>
    `<path d="M${cx} ${cy + sy * arm}V${cy}H${cx + sx * arm}" fill="none" stroke="${C.accent}" stroke-width="${width}"/>`;
  return corner(x, y, 1, 1) + corner(x + w, y, -1, 1) + corner(x, y + h, 1, -1) + corner(x + w, y + h, -1, -1);
}

function text(x, y, content, { size = 22, fill = C.ink, anchor = "start", spacing = 2, weight = 400 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" fill="${fill}" text-anchor="${anchor}">${content}</text>`;
}

/** The common frame: the chapter's ground, a console's dot grid, the viewfinder's corners, a path. */
function frame(label, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs><pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.4" fill="${C.line}"/></pattern></defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>
  ${brackets(56, 56, WIDTH - 112, HEIGHT - 112, 40, 3)}
  ${text(104, 112, `ELMZN / HOMELAB / ${label}`, { size: 20, fill: C.muted, spacing: 4 })}
  ${content}
</svg>`;
}

/** The homelab: its three machines, in line, as they stand — facts from the homelab's README. */
function homelab() {
  const ground = 770;
  const machines = [
    // A mini PC: flat, a power light, two ports.
    {
      x: 190, w: 300, h: 110, name: "EXTRANET · DMZ", spec: "Beelink S12 · N95 · 16G",
      body: (x, y, w, h) =>
        `<circle cx="${x + 34}" cy="${y + h / 2}" r="7" fill="${C.accent}"/>` +
        `<rect x="${x + w - 90}" y="${y + h / 2 - 9}" width="22" height="18" rx="2" fill="none" stroke="${C.muted}" stroke-width="2"/>` +
        `<rect x="${x + w - 58}" y="${y + h / 2 - 9}" width="22" height="18" rx="2" fill="none" stroke="${C.muted}" stroke-width="2"/>`,
    },
    // A tower: vents, a button, two drive bays.
    {
      x: 680, w: 240, h: 400, name: "INTRANET", spec: "i7-6700 · 16G · ZFS 4T",
      body: (x, y, w) =>
        Array.from({ length: 7 }, (_, i) => `<line x1="${x + 40}" y1="${y + 50 + i * 18}" x2="${x + w - 40}" y2="${y + 50 + i * 18}" stroke="${C.line}" stroke-width="4"/>`).join("") +
        `<circle cx="${x + w / 2}" cy="${y + 220}" r="16" fill="none" stroke="${C.accent}" stroke-width="3"/>` +
        `<rect x="${x + 40}" y="${y + 270}" width="${w - 80}" height="34" rx="3" fill="none" stroke="${C.muted}" stroke-width="2"/>` +
        `<rect x="${x + 40}" y="${y + 318}" width="${w - 80}" height="34" rx="3" fill="none" stroke="${C.muted}" stroke-width="2"/>`,
    },
    // A NAS: four drive bays and their lights.
    {
      x: 1110, w: 300, h: 230, name: "NAS", spec: "ZimaOS",
      body: (x, y, w) =>
        Array.from({ length: 4 }, (_, i) => {
          const bx = x + 32 + i * ((w - 64) / 4);
          const bw = (w - 64) / 4 - 14;
          return `<rect x="${bx}" y="${y + 36}" width="${bw}" height="140" rx="3" fill="none" stroke="${C.muted}" stroke-width="2"/>` +
            `<circle cx="${bx + bw / 2}" cy="${y + 196}" r="5" fill="${i < 2 ? C.accent : C.line}"/>`;
        }).join(""),
    },
  ];

  const bus = 290;
  const box = { x: 800, y: 190 };
  let svg = `<line x1="150" y1="${ground}" x2="${WIDTH - 150}" y2="${ground}" stroke="${C.line}" stroke-width="2"/>`;
  // The box, and the line from it to each machine.
  svg += `<line x1="${box.x}" y1="${box.y + 18}" x2="${box.x}" y2="${bus}" stroke="${C.muted}" stroke-width="2"/>`;
  const centres = machines.map((m) => m.x + m.w / 2);
  svg += `<line x1="${Math.min(...centres)}" y1="${bus}" x2="${Math.max(...centres)}" y2="${bus}" stroke="${C.muted}" stroke-width="2"/>`;
  svg += `<path d="M${box.x - 12} ${box.y}H${box.x + 12}M${box.x} ${box.y - 12}V${box.y + 12}" stroke="${C.ink}" stroke-width="2"/>`;
  svg += brackets(box.x - 22, box.y - 22, 44, 44, 12, 2.5);
  svg += text(box.x + 40, box.y + 8, "BOX", { size: 22 });

  for (const m of machines) {
    const y = ground - m.h;
    const cx = m.x + m.w / 2;
    svg += `<line x1="${cx}" y1="${bus}" x2="${cx}" y2="${y - 30}" stroke="${C.muted}" stroke-width="2"/>`;
    svg += `<rect x="${m.x}" y="${y}" width="${m.w}" height="${m.h}" rx="10" fill="${C.surface}" stroke="${C.ink}" stroke-width="2.5"/>`;
    svg += m.body(m.x, y, m.w, m.h);
    svg += brackets(m.x - 22, y - 22, m.w + 44, m.h + 44, 24, 3);
    svg += text(cx, ground + 64, m.name, { size: 26, anchor: "middle", spacing: 3 });
    svg += text(cx, ground + 102, m.spec, { size: 19, fill: C.muted, anchor: "middle", spacing: 1 });
  }
  return frame("MACHINES", svg);
}

/** A smooth, seeded curve: an illustration's line, not a measurement. */
function curve(seed, points, x, y, w, h) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  let value = 0.5;
  const values = Array.from({ length: points }, () => {
    value = Math.min(0.9, Math.max(0.1, value + (random() - 0.5) * 0.35));
    return value;
  });
  const at = (i) => [x + (i / (points - 1)) * w, y + h - values[i] * h];
  let d = `M${at(0).join(" ")}`;
  for (let i = 1; i < points; i += 1) {
    const [px, py] = at(i - 1);
    const [cx, cy] = at(i);
    const mx = (px + cx) / 2;
    d += `C${mx} ${py} ${mx} ${cy} ${cx} ${cy}`;
  }
  return { line: d, area: `${d}L${x + w} ${y + h}L${x} ${y + h}Z` };
}

/** Monitoring: four panels of a dashboard, each with its curve — no figure, nothing to misread as a measure. */
function supervision() {
  const panels = [
    { title: "CPU", seed: 7 },
    { title: "RAM", seed: 19 },
    { title: "ZFS", seed: 3 },
    { title: "DOCKER", seed: 42 },
  ];
  const left = 140;
  const top = 170;
  const gap = 40;
  const pw = (WIDTH - 2 * left - gap) / 2;
  const ph = (HEIGHT - top - 120 - gap) / 2;
  let svg = "";
  panels.forEach((panel, i) => {
    const x = left + (i % 2) * (pw + gap);
    const y = top + Math.floor(i / 2) * (ph + gap);
    svg += `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="8" fill="${C.surface}" stroke="${C.line}" stroke-width="2"/>`;
    svg += text(x + 28, y + 46, panel.title, { size: 20, fill: C.muted, spacing: 3 });
    for (let g = 1; g <= 3; g += 1) {
      const gy = y + 70 + ((ph - 100) / 4) * g;
      svg += `<line x1="${x + 28}" y1="${gy}" x2="${x + pw - 28}" y2="${gy}" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="4 8"/>`;
    }
    const { line, area } = curve(panel.seed, 14, x + 28, y + 70, pw - 56, ph - 100);
    svg += `<path d="${area}" fill="${C.accent}" fill-opacity="0.12"/>`;
    svg += `<path d="${line}" fill="none" stroke="${C.accent}" stroke-width="3"/>`;
    if (i === 0) svg += brackets(x - 16, y - 16, pw + 32, ph + 32, 28, 3);
  });
  return frame("SUPERVISION", svg);
}

/** Remote access: a phone on 4G, a WireGuard tunnel, the home network behind it. */
function remoteAccess() {
  const mid = 510;
  let svg = "";
  // The phone.
  svg += `<rect x="220" y="${mid - 170}" width="180" height="340" rx="26" fill="${C.surface}" stroke="${C.ink}" stroke-width="3"/>`;
  svg += `<rect x="238" y="${mid - 140}" width="144" height="262" rx="8" fill="none" stroke="${C.line}" stroke-width="2"/>`;
  svg += `<circle cx="310" cy="${mid + 145}" r="7" fill="none" stroke="${C.muted}" stroke-width="2"/>`;
  svg += brackets(196, mid - 194, 228, 388, 26, 3);
  svg += text(310, mid + 250, "4G", { size: 26, anchor: "middle", spacing: 4 });

  // The tunnel: its walls, the packets inside, the lock.
  const x1 = 450;
  const x2 = 1100;
  svg += `<line x1="${x1}" y1="${mid - 46}" x2="${x2}" y2="${mid - 46}" stroke="${C.accent}" stroke-width="3"/>`;
  svg += `<line x1="${x1}" y1="${mid + 46}" x2="${x2}" y2="${mid + 46}" stroke="${C.accent}" stroke-width="3"/>`;
  svg += `<line x1="${x1 + 20}" y1="${mid}" x2="${x2 - 20}" y2="${mid}" stroke="${C.muted}" stroke-width="6" stroke-dasharray="26 22"/>`;
  const lx = (x1 + x2) / 2;
  svg += `<rect x="${lx - 40}" y="${mid - 24}" width="80" height="62" rx="8" fill="${C.bg}" stroke="${C.accent}" stroke-width="3"/>`;
  svg += `<path d="M${lx - 22} ${mid - 24}V${mid - 44}A22 22 0 0 1 ${lx + 22} ${mid - 44}V${mid - 24}" fill="none" stroke="${C.accent}" stroke-width="3"/>`;
  svg += `<circle cx="${lx}" cy="${mid + 6}" r="7" fill="${C.accent}"/>`;
  svg += text(lx, mid - 100, "WIREGUARD", { size: 28, anchor: "middle", spacing: 6 });
  svg += text(lx, mid + 120, "SPLIT TUNNEL", { size: 19, fill: C.muted, anchor: "middle", spacing: 4 });

  // The house, and the home network inside it.
  const hx = 1150;
  const hw = 280;
  svg += `<path d="M${hx} ${mid - 60}L${hx + hw / 2} ${mid - 200}L${hx + hw} ${mid - 60}V${mid + 170}H${hx}Z" fill="${C.surface}" stroke="${C.ink}" stroke-width="3" stroke-linejoin="round"/>`;
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const nx = hx + 60 + c * 80;
      const ny = mid + 10 + r * 80;
      svg += `<path d="M${nx - 9} ${ny}H${nx + 9}M${nx} ${ny - 9}V${ny + 9}" stroke="${C.ink}" stroke-width="2"/>`;
      svg += brackets(nx - 18, ny - 18, 36, 36, 9, 2);
    }
  }
  svg += text(hx + hw / 2, mid + 250, "LAN", { size: 26, anchor: "middle", spacing: 4 });
  return frame("VPN", svg);
}

export const covers = { homelab, supervision, "acces-distant": remoteAccess };

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  for (const [slug, draw] of Object.entries(covers)) {
    await page.setContent(
      `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=block"><style>html,body{margin:0}</style></head><body>${draw()}</body></html>`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
    const dir = path.join(root, "public", "media", "projects", slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "cover.webp"), await sharp(png).webp({ quality: 86 }).toBuffer());
    console.log(`public/media/projects/${slug}/cover.webp`);
  }
  await browser.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
