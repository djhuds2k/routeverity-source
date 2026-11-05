import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";

it("retains the exact byte-identified Geist font's copyright and OFL even when its loader is build-only", () => {
  const root = resolve(__dirname, "..", "..", "..", "..");
  const inventory = z
    .object({
      packages: z.array(
        z.object({ name: z.string(), scopes: z.array(z.string()) }),
      ),
      assets: z.array(
        z.object({
          version: z.string().nullable(),
          source: z.unknown(),
          license: z.string().nullable(),
          productionInclusion: z.string(),
        }),
      ),
    })
    .parse(
      JSON.parse(
        readFileSync(resolve(root, "docs", "licensing-inventory.json"), "utf8"),
      ),
    );
  const fonts = inventory.assets.filter(
    (asset) =>
      asset.productionInclusion === "emitted static asset" &&
      asset.license?.startsWith("OFL-1.1"),
  );
  expect(fonts).toHaveLength(1);
  expect(fonts[0].version).toBe(
    "28258d0621216948416a859d32487ab6ad1c9effa0d08795698e70be3c917630",
  );
  expect(fonts[0].source).toEqual(
    expect.stringContaining("geist/dist/fonts/geist-sans/Geist-Variable.woff2"),
  );
  expect(inventory.packages.find((p) => p.name === "geist")?.scopes).toContain(
    "browser-font-asset",
  );
  const notices = readFileSync(
    resolve(root, "apps", "web", "public", "third-party-notices.txt"),
    "utf8",
  );
  expect(notices).toContain(
    "Copyright (c) 2023 Vercel, in collaboration with basement.studio",
  );
  expect(notices).toContain("SIL OPEN FONT LICENSE Version 1.1");
});
