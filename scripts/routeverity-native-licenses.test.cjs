const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const {
  nativeLicenseDeclarations,
  nativeNoticeFor,
} = require("./routeverity-native-licenses.cjs");
const root = resolve(__dirname, "..");
const records = JSON.parse(
  readFileSync(resolve(root, "docs/native-license-evidence.json"), "utf8"),
).records;
const binary = "@img/sharp-libvips-linux-x64@1.3.4";

test("vendor libultrahdr row supplies the uhdr declaration without changing its licence text", () => {
  const rows = nativeLicenseDeclarations(
    "| libultrahdr | MIT License |\r\n| libvips | LGPLv3 |",
    { uhdr: "2.0.2", vips: "8.18.7" },
  );
  assert.deepEqual(rows, [
    { name: "uhdr", version: "2.0.2", license: "MIT License" },
    { name: "vips", version: "8.18.7", license: "LGPLv3" },
  ]);
});
test("unknown component remains unknown rather than inheriting a nearby grant", () => {
  assert.equal(
    nativeLicenseDeclarations("| libultrahdr | MIT License |", {
      unknown: "1",
    })[0].license,
    null,
  );
});
test("a dual licence declaration is preserved verbatim without an inferred SPDX choice", () => {
  assert.equal(
    nativeLicenseDeclarations(
      "| libultrahdr | MIT and Apache, see upstream |",
      { uhdr: "2.0.2" },
    )[0].license,
    "MIT and Apache, see upstream",
  );
});
test("exact pinned native evidence returns the complete unmodified upstream dual text", () => {
  const evidence = nativeNoticeFor(root, "uhdr", "2.0.2", binary, records);
  assert.equal(
    evidence.text,
    readFileSync(resolve(root, records[0].file), "utf8"),
  );
  assert.match(evidence.text, /both the MIT license and the\s+Apache License/);
  assert.match(evidence.text, /The Android Open Source Project/);
});
test("evidence is scoped to the actual component, version and binary package", () => {
  assert.equal(nativeNoticeFor(root, "vips", "2.0.2", binary, records), null);
  assert.equal(nativeNoticeFor(root, "uhdr", "2.0.1", binary, records), null);
  assert.equal(
    nativeNoticeFor(root, "uhdr", "2.0.2", "unrelated@1", records),
    null,
  );
});
test("modified upstream text or a wrong recorded digest is rejected", () => {
  assert.throws(
    () =>
      nativeNoticeFor(root, "uhdr", "2.0.2", binary, [
        { ...records[0], sha256: "0".repeat(64) },
      ]),
    /checksum mismatch/,
  );
});
test("paths outside the licence directory are rejected before their content can be read", () => {
  assert.throws(
    () =>
      nativeNoticeFor(root, "uhdr", "2.0.2", binary, [
        { ...records[0], file: "../.env.local" },
      ]),
    /remain in docs\/licenses/,
  );
  assert.throws(
    () =>
      nativeNoticeFor(root, "uhdr", "2.0.2", binary, [
        { ...records[0], file: resolve(root, "NOTICE.md") },
      ]),
    /remain in docs\/licenses/,
  );
});
test("duplicate matching evidence cannot silently select a grant", () => {
  assert.throws(
    () =>
      nativeNoticeFor(root, "uhdr", "2.0.2", binary, [...records, ...records]),
    /Ambiguous/,
  );
});
