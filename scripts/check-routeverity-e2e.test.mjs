import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCompleteAcceptance } from "./check-routeverity-e2e.mjs";

function passing() {
  return {
    errors: [],
    stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
    suites: [
      {
        specs: [],
        suites: [
          {
            suites: [],
            specs: [
              {
                tests: [
                  {
                    expectedStatus: "passed",
                    status: "expected",
                    results: [{ status: "passed", retry: 0 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
test("accepts a complete nested passing report", () => {
  assert.equal(checkCompleteAcceptance(passing()), 1);
});
test("accepts reporter leaf suites with omitted child arrays", () => {
  const report = passing();
  delete report.suites[0].suites[0].suites;
  assert.equal(checkCompleteAcceptance(report), 1);
});
for (const [name, mutate] of [
  [
    "skipped",
    (r) => {
      r.stats.skipped = 1;
    },
  ],
  [
    "failed",
    (r) => {
      r.stats.unexpected = 1;
    },
  ],
  [
    "flaky",
    (r) => {
      r.stats.flaky = 1;
    },
  ],
  [
    "runner error",
    (r) => {
      r.errors.push({ message: "failure" });
    },
  ],
  [
    "empty",
    (r) => {
      r.suites = [];
      r.stats.expected = 0;
    },
  ],
  [
    "count mismatch",
    (r) => {
      r.stats.expected = 2;
    },
  ],
  [
    "missing stats",
    (r) => {
      delete r.stats;
    },
  ],
  [
    "malformed suites",
    (r) => {
      r.suites[0].specs = null;
    },
  ],
  [
    "expected failure",
    (r) => {
      r.suites[0].suites[0].specs[0].tests[0].expectedStatus = "failed";
    },
  ],
  [
    "not run",
    (r) => {
      r.suites[0].suites[0].specs[0].tests[0].results = [];
    },
  ],
  [
    "retry",
    (r) => {
      r.suites[0].suites[0].specs[0].tests[0].results.unshift({
        status: "failed",
      });
    },
  ],
  [
    "single retry",
    (r) => {
      r.suites[0].suites[0].specs[0].tests[0].results[0].retry = 1;
    },
  ],
  [
    "interrupted",
    (r) => {
      r.suites[0].suites[0].specs[0].tests[0].results[0].status = "interrupted";
    },
  ],
]) {
  test(`rejects ${name} acceptance`, () => {
    const report = passing();
    mutate(report);
    assert.throws(() => checkCompleteAcceptance(report));
  });
}
