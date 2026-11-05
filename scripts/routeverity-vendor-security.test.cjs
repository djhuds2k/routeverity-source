// Independently added for RouteVerity, 2026-10-30. See NOTICE.md.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { resolve, join, sep } = require("node:path");
const { test } = require("node:test");
const { spawnSync } = require("node:child_process");
const { Duplex } = require("node:stream");
const root =
  process.env.ROUTEVERITY_VENDOR_TEST_ROOT || resolve(__dirname, "..");
const appRequire = createRequire(join(root, "apps/web/package.json"));
const nextRequire = createRequire(appRequire.resolve("next/package.json"));

test("framework forwards the four repaired vendor entry points to exact installed packages", () => {
  for (const [name, version] of [
    ["cookie", "0.7.2"],
    ["picomatch", "4.0.4"],
    ["send", "0.19.0"],
    ["ws", "8.21.0"],
  ]) {
    assert.strictEqual(
      nextRequire(`next/dist/compiled/${name}`),
      nextRequire(name),
    );
    assert.equal(nextRequire(`${name}/package.json`).version, version);
  }
  assert.equal(nextRequire("@babel/core/package.json").version, "7.29.6");
});
test("cookie rejects delimiter injection while preserving valid session serialization", () => {
  const cookie = nextRequire("next/dist/compiled/cookie");
  assert.throws(() => cookie.serialize("probe; injected", "value"));
  assert.throws(() =>
    cookie.serialize("probe", "value", { path: "/; other=value" }),
  );
  assert.throws(() =>
    cookie.serialize("probe", "value", { domain: "example.com; other=value" }),
  );
  assert.match(
    cookie.serialize("session", "a=b", { httpOnly: true, path: "/" }),
    /^session=a%3Db; Path=\/; HttpOnly$/,
  );
});
test("glob POSIX classes do not inherit Object methods and normal image patterns still match", () => {
  const glob = nextRequire("next/dist/compiled/picomatch");
  assert.doesNotMatch(
    glob.makeRe("[[:constructor:]]").source,
    /function Object|native code/,
  );
  assert.equal(glob("/brand/**")("/brand/logo.png"), true);
  assert.equal(glob("/brand/**")("/private/logo.png"), false);
});
test("glob extglob quantifiers do not produce the known overlapping-alternative regex", () => {
  const probe = `const glob = require(process.argv[1]); for (const pattern of ['+(a|aa)', '+(*|?)', '+(+(a))', '*(+(a))', '+(+(+(a)))']) { let expression; try { expression = glob.makeRe(pattern); } catch { continue; } if (expression.test('a'.repeat(45)+'!')) throw Error('Unexpected extglob match'); }`;
  const result = spawnSync(
    process.execPath,
    ["--eval", probe, nextRequire.resolve("next/dist/compiled/picomatch")],
    { timeout: 2000, encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
test("static sender redirect body has no attacker-controlled anchor", () => {
  const send = nextRequire("next/dist/compiled/send");
  let body = "";
  const response = {
    setHeader() {},
    end(value) {
      body = String(value);
    },
  };
  const stream = send(
    { method: "GET", headers: {} },
    "javascript:ROUTEVERITY_LOCAL_ONLY",
  );
  stream.res = response;
  stream.redirect();
  assert.equal(response.statusCode, 301);
  assert.doesNotMatch(body, /<a\s|href=/);
});
test("WebSocket fragment limit rejects a bounded three-fragment message", async () => {
  const { Receiver } = nextRequire("next/dist/compiled/ws");
  const receiver = new Receiver({ maxFragments: 2, maxPayload: 1024 });
  assert.equal(receiver._maxFragments, 2);
  assert.ok("_maxBufferedChunks" in receiver);
  const failed = new Promise((resolveError) =>
    receiver.once("error", resolveError),
  );
  receiver.write(Buffer.from([0x02, 1, 97, 0x00, 1, 98, 0x80, 1, 99]));
  const error = await failed;
  assert.match(error.message, /fragment/i);
});
test("WebSocket close rejects non-byte typed-array reasons without sending a frame", () => {
  const { Sender } = nextRequire("next/dist/compiled/ws");
  let sent = false;
  const sender = new Sender({});
  sender.sendFrame = () => {
    sent = true;
  };
  assert.throws(
    () => sender.close(1000, new Float32Array(20), false),
    /Uint8Array/,
  );
  assert.equal(sent, false);
});
test("WebSocket upgrade rejects a request with a missing truncated upgrade header without crashing", () => {
  const { WebSocketServer } = nextRequire("next/dist/compiled/ws");
  const server = new WebSocketServer({ noServer: true });
  let response = "";
  const socket = new Duplex({
    read() {},
    write(chunk, encoding, done) {
      response += chunk.toString();
      done();
    },
  });
  assert.doesNotThrow(() =>
    server.handleUpgrade(
      { method: "GET", headers: {}, url: "/" },
      socket,
      Buffer.alloc(0),
      () => assert.fail("Invalid request upgraded"),
    ),
  );
  assert.match(response, /HTTP\/1\.1 400/);
  socket.destroy();
  server.close();
});

function withMaps(check) {
  const base = mkdtempSync(join(tmpdir(), "rv-vendor-map-"));
  const project = join(base, "project");
  mkdirSync(join(project, "src"), { recursive: true });
  writeFileSync(join(project, "package.json"), "{}");
  const map = (marker) => ({
    version: 3,
    sources: ["fixture.ts"],
    sourcesContent: [marker],
    names: [],
    mappings: "AAAA",
  });
  writeFileSync(
    join(project, "inside.map"),
    JSON.stringify(map("INSIDE_GENERATED_MAP")),
  );
  writeFileSync(
    join(base, "outside.map"),
    JSON.stringify(map("OUTSIDE_GENERATED_MAP")),
  );
  const babel = nextRequire("next/dist/compiled/babel/core");
  const compile = (url, extra = {}) =>
    babel.transformSync(`const value = 1;\n//# sourceMappingURL=${url}`, {
      filename: join(project, "src/input.js"),
      root: project,
      configFile: false,
      babelrc: false,
      sourceMaps: true,
      ...extra,
    });
  try {
    check({ base, project, map, compile });
  } finally {
    const owned = resolve(base),
      allowed = resolve(tmpdir()) + sep;
    assert.ok(
      owned.startsWith(allowed) &&
        owned.slice(allowed.length).startsWith("rv-vendor-map-"),
    );
    rmSync(owned, { recursive: true, force: true });
  }
}
test("compiled Babel cannot read relative or absolute maps outside the input package", () =>
  withMaps(({ base, compile }) => {
    for (const url of ["../../outside.map", join(base, "outside.map")])
      assert.doesNotMatch(
        JSON.stringify(compile(url).map),
        /OUTSIDE_GENERATED_MAP/,
      );
  }));
test("compiled Babel preserves package-contained, inline and explicitly supplied maps", () =>
  withMaps(({ map, compile }) => {
    assert.match(
      JSON.stringify(compile("../inside.map").map),
      /INSIDE_GENERATED_MAP/,
    );
    const inline = Buffer.from(
      JSON.stringify(map("INLINE_GENERATED_MAP")),
    ).toString("base64");
    assert.match(
      JSON.stringify(compile(`data:application/json;base64,${inline}`).map),
      /INLINE_GENERATED_MAP/,
    );
    assert.match(
      JSON.stringify(
        compile("../../outside.map", {
          inputSourceMap: map("EXPLICIT_GENERATED_MAP"),
        }).map,
      ),
      /EXPLICIT_GENERATED_MAP/,
    );
  }));
