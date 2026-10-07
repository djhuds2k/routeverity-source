import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const inventory = JSON.parse(
  readFileSync(resolve(root, "docs/licensing-exclusions.json"), "utf8"),
);
const status = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=normal"],
  { cwd: root, encoding: "utf8" },
);
if (status.trim())
  throw new Error(
    "Apply exclusions only to a clean checkout; preserve existing work first.",
  );
execFileSync("git", ["sparse-checkout", "init", "--no-cone"], {
  cwd: root,
  stdio: "inherit",
});
execFileSync("git", ["sparse-checkout", "set", "--no-cone", "--stdin"], {
  cwd: root,
  input: `${inventory.gitSparseCheckoutPatterns.join("\n")}\n`,
  stdio: ["pipe", "inherit", "inherit"],
});
console.log("Applied the machine-readable licensing exclusions.");
