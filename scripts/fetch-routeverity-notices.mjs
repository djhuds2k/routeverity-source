import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const inventory = JSON.parse(
  readFileSync(join(root, "docs", "licensing-inventory.json"), "utf8"),
);
const next = JSON.parse(
  readFileSync(
    join(root, "apps", "web", "node_modules", "next", "package.json"),
    "utf8",
  ),
);
const directory = join(root, "docs", "licenses");
mkdirSync(directory, { recursive: true });
async function text(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Public licence retrieval HTTP ${response.status}: ${url}`);
  return response.text();
}
const sourcesPath = join(root, "docs", "licensing-notice-sources.json");
const records = existsSync(sourcesPath)
  ? JSON.parse(readFileSync(sourcesPath, "utf8")).records.filter((r) =>
      inventory.packages.some(
        (p) => p.name === r.name && p.version === r.version,
      ),
    )
  : [];
const unresolved = [];
const cached = new Map();
let nextUpstream;
for (const record of records) {
  if (record.name.startsWith("@img/sharp-libvips-"))
    throw new Error(
      `Native bundle notice scope requires manual review before reusing supplemental text: ${record.name}@${record.version}`,
    );
}
for (const p of inventory.packages.filter(
  (p) =>
    p.scopes.some((s) => /chunk$|file-trace$/.test(s)) &&
    !p.attributionEvidence.length &&
    !p.scopes.includes("source-workspace") &&
    p.name !== "@prisma/client-generated",
)) {
  if (p.name.startsWith("@img/sharp-libvips-")) {
    unresolved.push({
      name: p.name,
      version: p.version,
      actualVersion: p.version,
      reason:
        "Native library bundle: the packaging repository's Apache-2.0 LICENSE covers build scripts, not all bundled libraries. Vendor licence summaries do not supply complete component copyright/licence texts, matching source or relinking material; manual scope review required.",
    });
    continue;
  }
  if (records.some((r) => r.name === p.name && r.version === p.version))
    continue;
  let actualVersion = p.version;
  let content;
  let source;
  let revision;
  if (p.version?.startsWith("bundled-with-next-")) {
    if (p.version !== `bundled-with-next-${next.version}`)
      throw new Error("Inventory and installed Next versions differ.");
    actualVersion =
      next.devDependencies?.[p.name] ?? next.dependencies?.[p.name];
    if (!actualVersion) {
      if (!nextUpstream) {
        nextUpstream = JSON.parse(
          await text(
            `https://raw.githubusercontent.com/vercel/next.js/v${next.version}/packages/next/package.json`,
          ),
        );
        if (
          nextUpstream?.name !== "next" ||
          nextUpstream.version !== next.version
        )
          throw new Error(
            "Upstream Next dependency evidence does not match the installed release.",
          );
      }
      actualVersion =
        nextUpstream.devDependencies?.[p.name] ??
        nextUpstream.dependencies?.[p.name];
    }
    for (const name of ["LICENSE", "LICENSE.md", "license", "license.md"]) {
      source = `https://raw.githubusercontent.com/vercel/next.js/v${next.version}/packages/next/src/compiled/${p.name}/${name}`;
      content = await text(source);
      if (content) {
        revision = `next-v${next.version}`;
        break;
      }
    }
  }
  if (
    !content &&
    p.name === "react-remove-scroll-bar" &&
    actualVersion === "2.3.8"
  ) {
    revision = "7301c160fda44cb8cf2b9fdfde61efad35736196";
    source = `https://raw.githubusercontent.com/theKashey/react-remove-scroll-bar/${revision}/LICENSE`;
    content = await text(source);
  }
  if (
    !content &&
    actualVersion &&
    /^\d+\.\d+\.\d+(?:-.*)?$/.test(actualVersion)
  ) {
    const metadata = await text(
      `https://registry.npmjs.org/${p.name}/${actualVersion}`,
    );
    if (metadata) {
      const published = JSON.parse(metadata);
      const url =
        typeof published.repository === "string"
          ? published.repository
          : published.repository?.url;
      const repo = url?.match(
        /github\.com[/:]([^/]+)\/([^/#]+?)(?:\.git)?(?:\/|#|$)/,
      );
      if (repo) {
        for (const ref of [
          published.gitHead,
          `${p.name}@${actualVersion}`,
          `v${actualVersion}`,
          actualVersion,
        ].filter(Boolean)) {
          revision = ref;
          const names = [
            "LICENSE",
            "LICENSE.md",
            "License.md",
            "license",
            "license.md",
            "LICENCE",
            "LICENSE.txt",
          ];
          if (p.name === "string-hash") names.push("README.md");
          for (const name of names) {
            source = `https://raw.githubusercontent.com/${repo[1]}/${repo[2]}/${encodeURIComponent(revision)}/${name}`;
            if (!cached.has(source)) cached.set(source, await text(source));
            content = cached.get(source);
            if (content) break;
          }
          if (content) break;
        }
      }
    }
  }
  if (!content || content.length < 50 || /^\s*</.test(content)) {
    unresolved.push({
      name: p.name,
      version: p.version,
      actualVersion,
      reason:
        "No verified version-pinned upstream licence text retrieved; manual review required.",
    });
    continue;
  }
  const sha256 = createHash("sha256").update(content).digest("hex");
  const file = `docs/licenses/${sha256}.txt`;
  if (!existsSync(join(root, file))) writeFileSync(join(root, file), content);
  records.push({
    name: p.name,
    version: p.version,
    actualVersion,
    declaredLicense: p.license,
    source,
    revision,
    sha256,
    file,
    note:
      p.name === "react-remove-scroll-bar"
        ? "Supplemental upstream author notice added in 2025; published 2.3.8 declares MIT but its npm gitHead is unavailable. Review this attribution provenance; this is not a claim that the later commit produced the installed binary."
        : undefined,
  });
}
writeFileSync(
  sourcesPath,
  JSON.stringify(
    {
      schemaVersion: 1,
      notice:
        "Unmodified public upstream licence texts (or original CC0 declaration) retrieved at package-published gitHead, exact version tag, or the exact Next vendored release; check compatibility with the installed component. Missing notices are not replaced with invented copyright.",
      records,
      unresolved,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ retrieved: records.length, unresolved }, null, 2));
if (unresolved.length) process.exitCode = 1;
