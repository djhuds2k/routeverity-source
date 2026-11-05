// Independently added for RouteVerity, 2026-10-30. See NOTICE.md.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const input = process.argv[2];
if (!input)
  throw new Error("Supply the pristine Next 15.5.28 package directory.");
const source = resolve(input);
const metadata = JSON.parse(
  readFileSync(resolve(source, "package.json"), "utf8"),
);
if (metadata.name !== "next" || metadata.version !== "15.5.28")
  throw new Error("Expected pristine Next 15.5.28.");
const policy = JSON.parse(
  readFileSync(resolve(root, "docs/security-vendor-patch.json"), "utf8"),
);
let patch = "";
for (const item of policy.files) {
  const original = readFileSync(resolve(source, item.path), "utf8");
  if (createHash("sha256").update(original).digest("hex") !== item.beforeSha256)
    throw new Error(`Pristine bundle fingerprint mismatch: ${item.path}`);
  let modified;
  if (item.dependency) {
    modified = `// RouteVerity security repair, 2026-10-30; original attribution retained.\nmodule.exports = require(${JSON.stringify(item.dependency)});\n`;
  } else {
    if (original.split(policy.babel.before).length !== 2)
      throw new Error(
        "Expected exactly one external Babel map-read expression.",
      );
    modified = original.replace(policy.babel.before, policy.babel.after);
  }
  if (createHash("sha256").update(modified).digest("hex") !== item.afterSha256)
    throw new Error(`Generated repair fingerprint mismatch: ${item.path}`);
  const lines = (value) => {
    const output = value.split("\n");
    if (value.endsWith("\n")) output.pop();
    return output;
  };
  const oldLines = lines(original),
    newLines = lines(modified);
  patch += `diff --git a/${item.path} b/${item.path}\n--- a/${item.path}\n+++ b/${item.path}\n@@ -1,${oldLines.length} +1,${newLines.length} @@\n`;
  for (const line of oldLines) patch += `-${line}\n`;
  if (!original.endsWith("\n")) patch += "\\ No newline at end of file\n";
  for (const line of newLines) patch += `+${line}\n`;
  if (!modified.endsWith("\n")) patch += "\\ No newline at end of file\n";
}
const output = resolve(root, policy.patch);
if (process.argv[3] === "--check") {
  if (readFileSync(output, "utf8") !== patch)
    throw new Error(
      "Checked-in Next patch differs from reproducible generation.",
    );
  console.log(
    "PASS: checked-in Next patch reproduces exactly from pristine inputs.",
  );
  process.exit(0);
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, patch);
console.log(
  `Prepared version-bound patch for ${policy.files.length} files; no installed package edited.`,
);
