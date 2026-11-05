// Independently added for RouteVerity, 2026-10-30. See NOTICE.md.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function verifyVendorPatch(root) {
  const read = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));
  const sha = (file) =>
    createHash("sha256").update(readFileSync(file)).digest("hex");
  const policy = read("docs/security-vendor-patch.json");
  const manifest = read("package.json");
  const appRequire = createRequire(join(root, "apps/web/package.json"));
  const nextFile = appRequire.resolve("next/package.json");
  const nextRequire = createRequire(nextFile);
  assert.equal(
    `next@${nextRequire("./package.json").version}`,
    policy.framework,
  );
  assert.equal(
    manifest.pnpm.patchedDependencies[policy.framework],
    policy.patch,
  );
  assert.deepEqual(
    manifest.pnpm.packageExtensions[policy.framework].dependencies,
    policy.dependencies,
  );
  const files = policy.files.map((file) => {
    const actual = sha(join(dirname(nextFile), file.path));
    assert.equal(
      actual,
      file.afterSha256,
      `Vendor repair absent/changed: ${file.path}`,
    );
    return {
      path: file.path,
      sha256: actual,
      forwarder: file.dependency ?? null,
    };
  });
  const dependencies = Object.entries(policy.dependencies).map(
    ([name, version]) => {
      assert.equal(
        nextRequire(`${name}/package.json`).version,
        version,
        `Unexpected Next repair dependency: ${name}`,
      );
      return { name, version };
    },
  );
  assert.equal(
    sha(
      nextRequire.resolve(
        "@babel/core/lib/transformation/read-input-source-map-file.js",
      ),
    ),
    policy.babel.readerSha256,
  );
  return {
    framework: policy.framework,
    patchSha256: sha(join(root, policy.patch)),
    files,
    dependencies,
    babel: {
      compiledCoreVersion: "7.26.10",
      readerVersion: "7.29.6",
      readerSha256: policy.babel.readerSha256,
      scope: policy.babel.scope,
    },
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  verifyVendorPatch(root);
  console.log(
    "PASS: exact Next patch, fixed dependency versions and publisher Babel reader verified.",
  );
}
