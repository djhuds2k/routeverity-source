import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const inventory = JSON.parse(
  readFileSync(join(root, "docs/licensing-exclusions.json"), "utf8"),
);
const inputs = [
  "LICENSE.md",
  "README.md",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  ".node-version",
  ".nvmrc",
  ".gitignore",
  ".cursorignore",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
  "apps/web/next.config.js",
  "apps/web/tailwind.config.ts",
  "apps/web/postcss.config.js",
  "apps/web/.env.example",
  "apps/web/.eslintrc.routeverity.cjs",
  "apps/web/vitest.routeverity.config.ts",
  "apps/web/playwright.routeverity.config.ts",
  "apps/web/scripts/routeverity-redirect-audit.ts",
  "apps/web/scripts/routeverity-click-enrichment.ts",
  "apps/web/middleware.ts",
  "apps/web/app",
  "apps/web/lib/routeverity",
  "apps/web/lib/prisma",
  "apps/web/lib/api/create-id.ts",
  "apps/web/lib/next-auth.d.ts",
  "apps/web/lib/api/oauth/constants.ts",
  "apps/web/lib/api/tokens/scopes.ts",
  "apps/web/lib/api/rbac/permissions.ts",
  "apps/web/lib/api/rbac/resources.ts",
  "apps/web/lib/middleware/utils/is-ip-in-range.ts",
  "apps/web/ui/routeverity",
  "apps/web/public",
  "apps/web/prisma/schema",
  "apps/web/tests/routeverity",
  "apps/web/tests/misc/create-id.test.ts",
  "apps/web/tests/misc/safe-decode-uri-component.test.ts",
  "apps/web/tests/misc/ip-cidr.test.ts",
  "apps/web/tests/tokens/get-granted-scopes-for-role.test.ts",
  "packages",
  "docs",
  "docker-compose.routeverity.yml",
  "scripts/local-routeverity.mjs",
  "scripts/check-routeverity-boundary.mjs",
  "scripts/apply-routeverity-exclusions.mjs",
  "scripts/export-routeverity-source.mjs",
];
const excluded = inventory.exclusions.map((item) => resolve(root, item.path));
const forbiddenNames = new Set([
  "node_modules",
  "dist",
  ".next",
  ".git",
  ".turbo",
  "upstream-reference",
  "test-results",
  "playwright-report",
]);

function allowed(path) {
  const parts = relative(root, path).split(/[\\/]/);
  const name = parts.at(-1);
  return (
    !["docs/progress.md", "docs/previous-routeverity-design-audit.md"].includes(
      relative(root, path).replaceAll("\\", "/"),
    ) &&
    !parts.some((part) => forbiddenNames.has(part)) &&
    !excluded.some(
      (base) =>
        path === base ||
        path.startsWith(`${base}\\`) ||
        path.startsWith(`${base}/`),
    ) &&
    (!name.startsWith(".env") || name === ".env.example") &&
    !/\.(?:log|pem|key|csv|ndjson|sql|tsbuildinfo)$/.test(name)
  );
}

function files(path) {
  if (!allowed(path)) return [];
  const entries = readdirSync(path, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const child = join(path, entry.name);
    return !allowed(child) ? [] : entry.isDirectory() ? files(child) : [child];
  });
}

const selected = [];
for (const input of inputs) {
  const path = resolve(root, input);
  if (!existsSync(path))
    throw new Error(`Required source input missing: ${input}`);
  if (
    input.endsWith("/") ||
    [
      "packages",
      "docs",
      "apps/web/app",
      "apps/web/lib/routeverity",
      "apps/web/lib/prisma",
      "apps/web/ui/routeverity",
      "apps/web/public",
      "apps/web/prisma/schema",
      "apps/web/tests/routeverity",
    ].includes(input)
  )
    selected.push(...files(path));
  else if (allowed(path)) selected.push(path);
}
const output = process.argv[2];
if (!output) {
  console.log(
    `Source export dry run: ${selected.length} files; no environment values, Git history, restricted trees or archived app selected.`,
  );
} else {
  if (!isAbsolute(output)) throw new Error("Use an absolute output path.");
  const destination = resolve(output);
  if (
    destination === root ||
    destination.startsWith(`${root}\\`) ||
    destination.startsWith(`${root}/`)
  )
    throw new Error("Export outside the repository.");
  if (existsSync(destination))
    throw new Error("Output already exists; choose a new empty destination.");
  mkdirSync(destination, { recursive: true });
  for (const path of selected)
    cpSync(path, join(destination, relative(root, path)));
  writeFileSync(
    join(destination, "routeverity-source-manifest.json"),
    JSON.stringify(
      {
        upstreamCommit: inventory.upstreamCommit,
        files: selected
          .map((path) => relative(root, path).replaceAll("\\", "/"))
          .sort(),
        notice:
          "Sanitized corresponding-source candidate. Review dependency notices and match the deployed revision before publishing. Private progress and design-audit records are omitted.",
      },
      null,
      2,
    ),
  );
  console.log(
    `Prepared ${selected.length} source files locally. Nothing published.`,
  );
}
