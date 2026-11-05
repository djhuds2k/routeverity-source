const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, rmSync, existsSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { buildInventoryPlugin } = require("./routeverity-build-inventory.cjs");

test("normal Next builds are unchanged and audit instrumentation requires explicit opt-in", () => {
  const config = require(
    join(__dirname, "..", "apps", "web", "next.config.js"),
  );
  const previous = process.env.ROUTEVERITY_LICENSE_AUDIT;
  try {
    delete process.env.ROUTEVERITY_LICENSE_AUDIT;
    const ordinary = { plugins: [] };
    assert.equal(config.webpack(ordinary, { isServer: false }), ordinary);
    assert.equal(ordinary.plugins.length, 0);
    process.env.ROUTEVERITY_LICENSE_AUDIT = "1";
    const audited = { plugins: [] };
    assert.equal(config.webpack(audited, { isServer: false }), audited);
    assert.equal(audited.plugins.length, 1);
  } finally {
    if (previous === undefined) delete process.env.ROUTEVERITY_LICENSE_AUDIT;
    else process.env.ROUTEVERITY_LICENSE_AUDIT = previous;
  }
});

test("records emitted and concatenated resources, but not unused files", () => {
  const root = mkdtempSync(join(tmpdir(), "rv-build-inventory-"));
  try {
    const emitted = {
      resource: join(root, "src", "a.js") + "?query",
      modules: [{ resource: join(root, "src", "b.js") }],
    };
    const unused = { resource: join(root, "unused.js") };
    const modules = [emitted, unused];
    let complete;
    buildInventoryPlugin(root, "browser").apply({
      hooks: {
        done: {
          tap(name, callback) {
            complete = callback;
          },
        },
      },
    });
    complete({
      hasErrors: () => false,
      compilation: {
        modules,
        chunkGraph: {
          getNumberOfModuleChunks: (module) => (module === unused ? 0 : 1),
        },
      },
    });

    const result = JSON.parse(
      readFileSync(
        join(root, "apps", "web", ".next", "routeverity-build-browser.json"),
        "utf8",
      ),
    );
    assert.equal(result.target, "browser");
    assert.deepEqual(result.resources, ["src/a.js", "src/b.js"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails explicitly for emitted resources outside the independent tree", () => {
  const root = mkdtempSync(join(tmpdir(), "rv-build-inventory-"));
  try {
    let complete;
    buildInventoryPlugin(root, "server").apply({
      hooks: {
        done: {
          tap(name, callback) {
            complete = callback;
          },
        },
      },
    });
    assert.throws(
      () =>
        complete({
          hasErrors: () => false,
          compilation: {
            modules: [{ resource: join(root, "..", "outside.js") }],
            chunkGraph: { getNumberOfModuleChunks: () => 1 },
          },
        }),
      /outside the source tree/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failed compilation does not produce success-shaped inventory evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "rv-build-inventory-"));
  try {
    let complete;
    buildInventoryPlugin(root, "server").apply({
      hooks: {
        done: {
          tap(name, callback) {
            complete = callback;
          },
        },
      },
    });
    complete({ hasErrors: () => true });
    assert.equal(existsSync(join(root, "apps", "web", ".next")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
