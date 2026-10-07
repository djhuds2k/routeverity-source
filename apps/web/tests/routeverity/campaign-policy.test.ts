import {
  campaignReadiness,
  campaignSchema,
  isCampaignDestinationAllowed,
  normalizeDestinationHostname,
  policySchema,
  trackingParametersSchema,
} from "@/lib/routeverity/campaign-policy";
import { describe, expect, it } from "vitest";

const input = {
  name: "Summer launch",
  advertiser: "Example advertiser",
  trafficSource: "GOOGLE_ADS",
  externalCampaignId: "",
  currency: "gbp",
  status: "DRAFT",
  trackingDomainId: "",
  notes: "",
  destinationDomains: [],
  trackingParameters: {},
};
const domain = {
  type: "TRANSPARENT_TRACKING",
  verified: true,
  suspendedAt: null,
  archived: false,
};
const rules = [{ hostname: "example.com", includeSubdomains: false }];

describe("campaign configuration validation", () => {
  it("allows an incomplete draft, normalizing currency and hostname inputs", () => {
    expect(campaignSchema.parse(input).currency).toBe("GBP");
    expect(
      policySchema.parse([
        { hostname: " SHOP.Example.COM. ", includeSubdomains: false },
      ])[0].hostname,
    ).toBe("shop.example.com");
    expect(normalizeDestinationHostname("bücher.de")).toBe("xn--bcher-kva.de");
  });
  it.each([
    "localhost",
    "127.0.0.1",
    "[::1]",
    "example.local",
    "example.internal",
    "example.test",
    "example.invalid",
    "*.example.com",
    "https://example.com",
    "example.com:443",
    "user@example.com",
    "example.com/path",
    "example.com%2e",
    "example..com",
    "example.com..",
  ])("rejects invalid public policy hostname %s", (hostname) => {
    expect(
      policySchema.safeParse([{ hostname, includeSubdomains: false }]).success,
    ).toBe(false);
  });
  it("rejects duplicate canonical hostnames and more than 50 policies", () => {
    expect(
      policySchema.safeParse([
        { hostname: "example.com", includeSubdomains: false },
        { hostname: "EXAMPLE.COM.", includeSubdomains: true },
      ]).success,
    ).toBe(false);
    expect(
      policySchema.safeParse(
        Array.from({ length: 51 }, (_, i) => ({
          hostname: `site${i}.example.com`,
          includeSubdomains: false,
        })),
      ).success,
    ).toBe(false);
    expect(
      policySchema.safeParse(
        Array.from({ length: 50 }, (_, i) => ({
          hostname: `site${i}.example.com`,
          includeSubdomains: false,
        })),
      ).success,
    ).toBe(true);
  });
  it("requires destinations for ACTIVE but not suspended/archived drafts", () => {
    expect(
      campaignSchema.safeParse({ ...input, status: "ACTIVE" }).success,
    ).toBe(false);
    for (const status of ["SUSPENDED", "ARCHIVED"])
      expect(campaignSchema.safeParse({ ...input, status }).success).toBe(true);
  });
  it("accepts only known traffic sources, currencies and statuses", () => {
    for (const override of [
      { currency: "ZZZ" },
      { status: "LIVE" },
      { trafficSource: "GOOGLE_CERTIFIED" },
    ])
      expect(campaignSchema.safeParse({ ...input, ...override }).success).toBe(
        false,
      );
  });
  it("accepts only the five bounded UTM fields, not reserved click/control fields", () => {
    expect(
      trackingParametersSchema.parse({
        utm_source: " google ",
        utm_campaign: "summer & autumn",
      }),
    ).toEqual({ utm_source: "google", utm_campaign: "summer & autumn" });
    for (const data of [
      { url: "https://evil.example" },
      { rv_campaign: "foreign" },
      { rv_click: "spoof" },
      { gclid: "static-id" },
      { utm_source: "x".repeat(501) },
    ])
      expect(trackingParametersSchema.safeParse(data).success).toBe(false);
  });
});

describe("exact and explicit subdomain matching", () => {
  it.each([
    "https://example.com/offer?a=1#section",
    "https://EXAMPLE.com./offer",
    "http://example.com",
  ])("allows exact host %s", (url) => {
    expect(isCampaignDestinationAllowed(url, rules)).toBe(true);
  });
  it.each([
    "https://shop.example.com",
    "https://example.com.evil.org",
    "https://notexample.com",
    "https://example.com@evil.org",
    "https://user:secret@example.com",
    "javascript:alert(1)",
    "https://127.0.0.1",
    "http://2130706433",
    "https://example.com\\@evil.org",
  ])("rejects non-exact/unsafe destination %s", (url) => {
    expect(isCampaignDestinationAllowed(url, rules)).toBe(false);
  });
  it("opt-in includes arbitrary-depth subdomains but never suffix lookalikes", () => {
    const broad = [{ hostname: "example.com", includeSubdomains: true }];
    expect(
      isCampaignDestinationAllowed("https://deep.shop.example.com/a", broad),
    ).toBe(true);
    expect(
      isCampaignDestinationAllowed("https://example.com.evil.org/a", broad),
    ).toBe(false);
    expect(
      isCampaignDestinationAllowed("https://notexample.com/a", broad),
    ).toBe(false);
  });
  it("matches international hostnames through canonical ASCII", () => {
    expect(
      isCampaignDestinationAllowed("https://bücher.de/offer", [
        { hostname: "xn--bcher-kva.de", includeSubdomains: false },
      ]),
    ).toBe(true);
  });
});

describe("tracking readiness is not a live tracking claim", () => {
  it("returns no configuration blocker for an active, configured campaign", () => {
    expect(
      campaignReadiness({
        status: "ACTIVE",
        destinationDomains: rules,
        trackingDomain: domain,
      }),
    ).toBeNull();
  });
  it.each([
    { status: "DRAFT" },
    { status: "SUSPENDED" },
    { status: "ARCHIVED" },
    { destinationDomains: [] },
    { trackingDomain: null },
    { trackingDomain: { ...domain, verified: false } },
    { trackingDomain: { ...domain, suspendedAt: new Date() } },
    { trackingDomain: { ...domain, archived: true } },
    { trackingDomain: { ...domain, type: "STANDARD_LINK" } },
    { trackingDomain: { ...domain, type: "DEVELOPMENT" } },
  ])("blocks unavailable configuration: %j", (override) => {
    expect(
      campaignReadiness({
        status: "ACTIVE",
        destinationDomains: rules,
        trackingDomain: domain,
        ...override,
      }),
    ).toBeTruthy();
  });
});
