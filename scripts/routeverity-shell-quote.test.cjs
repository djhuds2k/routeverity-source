const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { resolve, dirname, join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const testRoot =
  process.env.ROUTEVERITY_SHELL_TEST_ROOT || resolve(__dirname, "..");
const webRequire = createRequire(resolve(testRoot, "apps/web/package.json"));
const concurrentlyPackage = webRequire.resolve("concurrently/package.json");
const callerRequire = createRequire(concurrentlyPackage);
const { parse, quote } = callerRequire("shell-quote");

test("command quoting preserves literal arguments and shell metacharacters", () => {
  const args = [
    "node",
    "two words",
    "single'quote",
    'double"quote',
    "$HOME",
    "`literal`",
    "line\nbreak",
    "; echo literal",
  ];
  assert.deepEqual(parse(quote(args)), args);
});

test("object operators cannot inject line terminators directly or through envFn", () => {
  for (const newline of ["\n", "\r", "\u2028", "\u2029"]) {
    assert.throws(
      () => quote([{ op: ";" + newline + "printf fixture" }]),
      TypeError,
    );
    const tokens = parse("echo $FIXTURE", () => ({
      op: ";" + newline + "printf fixture",
    }));
    let quoted;
    try {
      quoted = quote(tokens);
    } catch (error) {
      assert.ok(error instanceof TypeError);
    }
    if (quoted !== undefined) {
      // The parser can render Unicode separators as literal strings rather than
      // preserving an object token. Those values must remain literal on quoting.
      assert.ok(tokens.every((token) => typeof token === "string"));
      assert.deepEqual(parse(quoted), tokens);
    }
    assert.throws(
      () => quote([{ comment: "fixture" + newline + "printf fixture" }]),
      TypeError,
    );
  }
});

test("documented operator and glob tokens remain usable; malformed shapes fail", () => {
  for (const op of ["||", "&&", ";", "|", "<", ">"])
    assert.equal(typeof quote([{ op }]), "string");
  assert.equal(typeof quote([{ op: "glob", pattern: "*.js" }]), "string");
  assert.throws(
    () => quote([{ op: "glob", pattern: "*\nfixture" }]),
    TypeError,
  );
  assert.throws(() => quote([{ op: "unsupported" }]), TypeError);
  assert.throws(() => quote([{ arbitrary: "fixture" }]), TypeError);
});

test("tokens after a comment cannot resume shell execution through a line terminator", () => {
  for (const newline of ["\n", "\r", "\u2028", "\u2029"]) {
    assert.throws(
      () =>
        quote([
          "echo",
          "fixture",
          { comment: "safe" },
          "value" + newline + "printf fixture;#",
        ]),
      TypeError,
    );
    const prefix = parse("echo fixture # safe");
    assert.throws(
      () => quote(prefix.concat("value" + newline + "printf fixture;#")),
      TypeError,
    );
  }
  assert.equal(
    typeof quote(["echo", "fixture", { comment: "safe" }, "literal"]),
    "string",
  );
});

test("the retained concurrently command runs quoted child commands successfully", () => {
  const metadata = JSON.parse(readFileSync(concurrentlyPackage, "utf8"));
  const bin =
    typeof metadata.bin === "string" ? metadata.bin : metadata.bin.concurrently;
  const result = spawnSync(
    process.execPath,
    [
      join(dirname(concurrentlyPackage), bin),
      "--raw",
      "--success",
      "all",
      'node -e "console.log(4101)"',
      'node -e "console.log(4102)"',
    ],
    {
      env: {
        ...process.env,
        PATH:
          dirname(process.execPath) +
          require("node:path").delimiter +
          process.env.PATH,
      },
      encoding: "utf8",
      timeout: 20000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /4101/);
  assert.match(result.stdout, /4102/);
});
