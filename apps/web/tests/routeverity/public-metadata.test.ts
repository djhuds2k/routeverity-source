import {
  indexingPolicy,
  publicPaths,
} from "@/lib/routeverity/indexing-policy.cjs";
import { publicMetadata } from "@/lib/routeverity/public-metadata";
import { afterEach, expect, it, vi } from "vitest";
import robots from "../../app/robots";
import sitemap from "../../app/sitemap";
import nextConfig from "../../next.config";

const release = {
  NEXTAUTH_URL: "https://routeverity.com",
  NODE_ENV: "production",
  ROUTEVERITY_PUBLIC_INDEXING: "enabled",
};
afterEach(() => vi.unstubAllEnvs());
function configure(values = release) {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
  vi.stubEnv("VERCEL_ENV", "production");
}

it("requires explicit release configuration for indexing", () => {
  expect(indexingPolicy({ NEXTAUTH_URL: release.NEXTAUTH_URL }).enabled).toBe(
    false,
  );
  expect(indexingPolicy(release)).toEqual({
    enabled: true,
    origin: release.NEXTAUTH_URL,
  });
});
it.each([
  { NODE_ENV: "development" },
  { NODE_ENV: "test" },
  { VERCEL_ENV: "preview" },
  { VERCEL_ENV: "development" },
  { VERCEL_ENV: "unknown" },
  { ROUTEVERITY_PUBLIC_INDEXING: "true" },
  { ROUTEVERITY_PUBLIC_INDEXING: "" },
  { NEXTAUTH_URL: "http://routeverity.com" },
  { NEXTAUTH_URL: "https://localhost" },
  { NEXTAUTH_URL: "https://127.0.0.1" },
  { NEXTAUTH_URL: "https://[::1]" },
  { NEXTAUTH_URL: "https://app.example.test" },
  { NEXTAUTH_URL: "https://app.localhost" },
  { NEXTAUTH_URL: "https://app.internal" },
  { NEXTAUTH_URL: "https://bad_host.com" },
  { NEXTAUTH_URL: "https://user:password@routeverity.com" },
  { NEXTAUTH_URL: "https://routeverity.com:444" },
  { NEXTAUTH_URL: "https://routeverity.com/path" },
  { NEXTAUTH_URL: "https://routeverity.com/?preview=1" },
  { NEXTAUTH_URL: "https://routeverity.com/#preview" },
  { NEXTAUTH_URL: "invalid" },
])(
  "keeps unsafe or non-release configuration out of search: %j",
  (override) => {
    expect(indexingPolicy({ ...release, ...override }).enabled).toBe(false);
  },
);
it("keeps preproduction crawling blocked and the sitemap empty", () => {
  configure({ ...release, ROUTEVERITY_PUBLIC_INDEXING: "" });
  expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  expect(sitemap()).toEqual([]);
  expect(publicMetadata("/features", "Features", "Evaluation").robots).toEqual({
    index: false,
    follow: false,
  });
});
it("lists only fixed public canonical URLs after explicit release activation", () => {
  configure();
  expect(sitemap().map((item) => item.url)).toEqual(
    publicPaths.map((path) => new URL(path, release.NEXTAUTH_URL).toString()),
  );
  const output = JSON.stringify(sitemap());
  for (const privatePath of [
    "/api/",
    "/app/",
    "/account",
    "/login",
    "/click",
    "?",
    "#",
  ])
    expect(output).not.toContain(privatePath);
  expect(robots().sitemap).toBe("https://routeverity.com/sitemap.xml");
});
it("provides canonical, social and per-page metadata from the configured origin", () => {
  configure();
  const metadata = publicMetadata(
    "/features",
    "Campaigns",
    "Evaluation capabilities",
  );
  expect(metadata.alternates).toEqual({
    canonical: "https://routeverity.com/features",
  });
  expect(metadata.openGraph).toMatchObject({
    url: "https://routeverity.com/features",
    siteName: "RouteVerity",
  });
  expect(metadata.twitter).toMatchObject({ card: "summary" });
  expect(metadata.robots).toEqual({ index: true, follow: true });
});
it("keeps a noindex HTTP default and limits index overrides to public paths on the canonical host", async () => {
  configure();
  const headers = await nextConfig.headers!();
  expect(headers[0]).toMatchObject({
    source: "/:path*",
    headers: expect.arrayContaining([
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ]),
  });
  expect(headers.slice(1).map((rule) => rule.source)).toEqual(publicPaths);
  for (const rule of headers.slice(1))
    expect(rule).toMatchObject({
      has: [{ type: "host", value: "routeverity\\.com" }],
      headers: [{ key: "X-Robots-Tag", value: "index, follow" }],
    });
  vi.stubEnv("VERCEL_ENV", "preview");
  expect((await nextConfig.headers!()).length).toBe(1);
});
