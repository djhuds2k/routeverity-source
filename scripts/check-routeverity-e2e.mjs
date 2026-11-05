import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function checkCompleteAcceptance(report) {
  const fail = () => {
    throw new Error(
      "Acceptance must contain a complete passing suite with no skips, retries, expected failures or runner errors.",
    );
  };
  if (
    !report ||
    !Array.isArray(report.suites) ||
    !Array.isArray(report.errors) ||
    report.errors.length
  )
    fail();
  const tests = [];
  function visit(suite) {
    if (
      !suite ||
      !Array.isArray(suite.specs) ||
      (suite.suites !== undefined && !Array.isArray(suite.suites))
    )
      fail();
    for (const spec of suite.specs) {
      if (!Array.isArray(spec.tests) || !spec.tests.length) fail();
      tests.push(...spec.tests);
    }
    (suite.suites ?? []).forEach(visit);
  }
  report.suites.forEach(visit);
  const stats = report.stats;
  if (
    !tests.length ||
    !stats ||
    stats.expected !== tests.length ||
    stats.unexpected !== 0 ||
    stats.flaky !== 0 ||
    stats.skipped !== 0
  )
    fail();
  for (const test of tests) {
    if (
      test.expectedStatus !== "passed" ||
      test.status !== "expected" ||
      !Array.isArray(test.results) ||
      test.results.length !== 1 ||
      test.results[0].status !== "passed" ||
      test.results[0].retry !== 0
    )
      fail();
  }
  return tests.length;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
    console.log(
      `PASS: ${checkCompleteAcceptance(report)} acceptance tests, no skips or retries.`,
    );
  } catch {
    console.error(
      "FAIL: missing, invalid or incomplete RouteVerity acceptance report.",
    );
    process.exitCode = 1;
  }
}
