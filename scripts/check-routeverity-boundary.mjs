import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const inventory = JSON.parse(
  readFileSync(join(root, "docs", "licensing-exclusions.json"), "utf8"),
);
const errors = [];
for (const { path } of inventory.exclusions) {
  if (existsSync(resolve(root, path)))
    errors.push(`Excluded tree is present: ${path}`);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      [
        "node_modules",
        "dist",
        ".next",
        ".turbo",
        "upstream-reference",
      ].includes(entry.name)
    )
      return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const roots = [
  "apps/web/app",
  "apps/web/lib/routeverity",
  "apps/web/ui/routeverity",
  "packages/ui/src",
  "packages/email/src",
];
const restrictedImport =
  /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*(?:icons\/nucleo|stripe-app|app\/\(ee\)|\/\(ee\)\/|upstream-reference)[^"']*["']/;
for (const directory of roots) {
  for (const path of walk(resolve(root, directory))) {
    if (!/\.(?:tsx?|jsx?)$/.test(path)) continue;
    const text = readFileSync(path, "utf8");
    if (restrictedImport.test(text))
      errors.push(`Restricted import: ${relative(root, path)}`);
    if (/https?:\/\/[^"'\s]*nucleo[^"'\s]*/i.test(text))
      errors.push(`Restricted hosted icon: ${relative(root, path)}`);
  }
}
for (const manifest of [
  "package.json",
  "apps/web/package.json",
  "packages/ui/package.json",
  "packages/email/package.json",
]) {
  const json = JSON.parse(readFileSync(resolve(root, manifest), "utf8"));
  if (
    Object.keys({ ...json.dependencies, ...json.devDependencies }).some(
      (name) => name.includes("stripe-app"),
    )
  )
    errors.push(`Proprietary dependency: ${manifest}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "PASS: four excluded trees absent; shipped app/UI/email contain no restricted imports or hosted icons.",
  );
