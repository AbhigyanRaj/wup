/**
 * npm workspaces hoist optional native packages (lightningcss-*, @tailwindcss/oxide-*)
 * to the repo root. Next.js Turbopack runs PostCSS from apps/web and only resolves
 * sibling packages under apps/web/node_modules — link hoisted copies here.
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const webNm = path.join(repoRoot, "apps", "web", "node_modules");
const rootNm = path.join(repoRoot, "node_modules");
const webPkgPath = path.join(repoRoot, "apps", "web", "package.json");

if (!fs.existsSync(webPkgPath) || !fs.existsSync(webNm)) {
  process.exit(0);
}

const webPkg = JSON.parse(fs.readFileSync(webPkgPath, "utf8"));
const optional = Object.keys(webPkg.optionalDependencies || {});
if (optional.length === 0) process.exit(0);

function segments(name) {
  return name.startsWith("@") ? name.split("/") : [name];
}

function linkPackage(name) {
  const rel = segments(name);
  const target = path.join(rootNm, ...rel);
  const linkPath = path.join(webNm, ...rel);
  if (!fs.existsSync(target)) return;
  if (fs.existsSync(linkPath)) return;
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  const linkType = process.platform === "win32" ? "junction" : "dir";
  try {
    fs.symlinkSync(target, linkPath, linkType);
    console.log(`[wup] Linked ${name} into apps/web/node_modules (Turbopack/CSS native)`);
  } catch (e) {
    console.warn(`[wup] Could not link ${name}:`, e.message);
  }
}

for (const name of optional) {
  linkPackage(name);
}
