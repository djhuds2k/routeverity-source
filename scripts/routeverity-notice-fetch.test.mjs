import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

function fixture(packages, records, check, options = {}) {
  const root = mkdtempSync(join(tmpdir(), "rv-notice-fetch-"));
  try {
    mkdirSync(join(root, "scripts"));
    mkdirSync(join(root, "docs"));
    mkdirSync(join(root, "apps/web/node_modules/next"), { recursive: true });
    cpSync(
      new URL("./fetch-routeverity-notices.mjs", import.meta.url),
      join(root, "scripts/fetch-routeverity-notices.mjs"),
    );
    writeFileSync(
      join(root, "docs/licensing-inventory.json"),
      JSON.stringify({
        packages: packages.map((item) => ({
          version: "1.2.3",
          license: "LGPL-3.0-or-later",
          scopes: ["server-file-trace"],
          attributionEvidence: [],
          ...(typeof item === "string" ? { name: item } : item),
        })),
      }),
    );
    const index = join(root, "docs/licensing-notice-sources.json");
    writeFileSync(index, JSON.stringify({ records, unresolved: [] }));
    writeFileSync(
      join(root, "apps/web/node_modules/next/package.json"),
      JSON.stringify({ version: options.nextVersion ?? "15.5.8" }),
    );
    const stub = join(root, "no-network.mjs");
    writeFileSync(
      stub,
      options.fetchStub ??
        'globalThis.fetch = () => { throw new Error("UNEXPECTED_NETWORK_REQUEST"); };\n',
    );
    const before = readFileSync(index, "utf8");
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(stub).href,
        join(root, "scripts/fetch-routeverity-notices.mjs"),
      ],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.ifError(result.error);
    check(result, JSON.parse(readFileSync(index, "utf8")), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("native libvips bundles remain unresolved without misusing the build-script licence", () => {
  const names = [
    "@img/sharp-libvips-linux-x64",
    "@img/sharp-libvips-linuxmusl-x64",
  ];
  fixture(names, [], (result, index) => {
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.deepEqual(index.records, []);
    assert.deepEqual(
      index.unresolved.map((item) => item.name),
      names,
    );
    for (const item of index.unresolved) {
      assert.match(item.reason, /Apache-2\.0 LICENSE covers build scripts/);
      assert.match(item.reason, /manual scope review required/);
    }
    assert.doesNotMatch(result.stdout, /UNEXPECTED_NETWORK_REQUEST/);
  });
});

test("cached native supplemental text fails explicitly without overwriting the index", () => {
  const name = "@img/sharp-libvips-linux-x64";
  const records = [
    {
      name,
      version: "1.2.3",
      declaredLicense: "Apache-2.0",
      source: "https://example.test/build-scripts/LICENSE",
    },
  ];
  fixture([name], records, (result, index, before) => {
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /Native bundle notice scope requires manual review/,
    );
    assert.equal(JSON.stringify(index), before);
    assert.doesNotMatch(result.stderr, /UNEXPECTED_NETWORK_REQUEST/);
  });
});

test("ordinary cached package notice retrieval remains unchanged and offline", () => {
  const name = "ordinary-fixture";
  const records = [
    { name, version: "1.2.3", source: "https://example.test/1.2.3/LICENSE" },
  ];
  fixture([name], records, (result, index) => {
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(index.records, records);
    assert.deepEqual(index.unresolved, []);
    assert.doesNotMatch(result.stdout, /UNEXPECTED_NETWORK_REQUEST/);
  });
});

test("vendored attribution uses the exact Next package dependency evidence and pinned upstream licence", () => {
  fixture(
    [
      {
        name: "vendored-fixture",
        version: "bundled-with-next-15.5.28",
        license: "MIT",
      },
    ],
    [],
    (result, index) => {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(index.records.length, 1);
      assert.equal(index.records[0].actualVersion, "1.2.3");
      assert.equal(
        index.records[0].source,
        "https://raw.githubusercontent.com/example/pinned/abcdef123456/LICENSE",
      );
      assert.deepEqual(index.unresolved, []);
    },
    {
      nextVersion: "15.5.28",
      fetchStub: `globalThis.fetch = async (url) => {
      if (url === "https://raw.githubusercontent.com/vercel/next.js/v15.5.28/packages/next/package.json") return new Response(JSON.stringify({ name: "next", version: "15.5.28", devDependencies: { "vendored-fixture": "1.2.3" } }));
      if (url.startsWith("https://raw.githubusercontent.com/vercel/next.js/v15.5.28/packages/next/src/compiled/")) return new Response("", { status: 404 });
      if (url === "https://registry.npmjs.org/vendored-fixture/1.2.3") return new Response(JSON.stringify({ repository: { url: "git+https://github.com/example/pinned.git" }, gitHead: "abcdef123456" }));
      if (url === "https://raw.githubusercontent.com/example/pinned/abcdef123456/LICENSE") return new Response("Copyright Fixture. Permission is hereby granted, free of charge, to any person obtaining a copy of this software.");
      throw new Error("UNEXPECTED_NETWORK_REQUEST " + url);
    };`,
    },
  );
});

test("mismatched upstream release evidence cannot assign a vendored licence", () => {
  fixture(
    [{ name: "vendored-fixture", version: "bundled-with-next-15.5.28" }],
    [],
    (result, index, before) => {
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /Upstream Next dependency evidence does not match/,
      );
      assert.equal(JSON.stringify(index), before);
    },
    {
      nextVersion: "15.5.28",
      fetchStub: `globalThis.fetch = async (url) => {
      if (url === "https://raw.githubusercontent.com/vercel/next.js/v15.5.28/packages/next/package.json") return new Response(JSON.stringify({ name: "next", version: "15.5.27", devDependencies: { "vendored-fixture": "1.2.3" } }));
      throw new Error("UNEXPECTED_NETWORK_REQUEST " + url);
    };`,
    },
  );
});

test("a stale inventory cannot retrieve notices for a different installed Next release", () => {
  fixture(
    [{ name: "vendored-fixture", version: "bundled-with-next-15.5.27" }],
    [],
    (result, index, before) => {
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /Inventory and installed Next versions differ/,
      );
      assert.equal(JSON.stringify(index), before);
      assert.doesNotMatch(result.stderr, /UNEXPECTED_NETWORK_REQUEST/);
    },
    { nextVersion: "15.5.28" },
  );
});
