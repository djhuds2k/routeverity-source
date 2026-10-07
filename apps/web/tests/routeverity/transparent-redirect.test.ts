import {
  fingerprint,
  issueTrackingToken,
} from "@/lib/routeverity/transparent-policy";
import { transparentRedirect } from "@/lib/routeverity/transparent-redirect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  audit: vi.fn(),
  allow: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeVerityCampaign: { findUnique: mocks.find },
    routeVerityRedirectAudit: { create: mocks.audit },
  },
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
const credential = issueTrackingToken();
const campaign = {
  id: "cmp_transparent_test",
  projectId: "ws_test",
  status: "ACTIVE",
  updatedAt: new Date("2026-10-07T10:00:00Z"),
  trackingTokenHash: credential.hash,
  trackingTokenIssuedAt: new Date("2026-10-07T10:01:00Z"),
  project: { disabledAt: null },
  destinationDomains: [{ hostname: "example.com", includeSubdomains: true }],
  trackingDomain: {
    slug: "track.example.com",
    projectId: "ws_test",
    type: "TRANSPARENT_TRACKING",
    verified: true,
    suspendedAt: null,
    archived: false,
  },
  trackingParameters: { utm_source: "must-not-override-visible-destination" },
};
const destination =
  "https://shop.example.com/path%2fraw?b=2&a=1&a=2&q=a+b#section";
function request(
  options: {
    destination?: string;
    token?: string;
    host?: string;
    method?: string;
    headers?: Record<string, string | undefined>;
  } = {},
) {
  const query = new URLSearchParams({
    url: options.destination ?? destination,
    rv_campaign: campaign.id,
    rv_token: options.token ?? credential.token,
  });
  return new Request(`https://track.example.com/click?${query}`, {
    method: options.method ?? "GET",
    headers: {
      host: options.host ?? "track.example.com",
      ...Object.fromEntries(
        Object.entries(options.headers ?? {}).filter(
          (entry): entry is [string, string] => entry[1] !== undefined,
        ),
      ),
    },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue(structuredClone(campaign));
  mocks.allow.mockResolvedValue(true);
  mocks.audit.mockResolvedValue({});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("transparent redirect service", () => {
  it("persists bounded Google metadata in the same core insert, never raw IDs or a modified target", async () => {
    const original = request();
    const response = await transparentRedirect(
      new Request(
        `${original.url}&gclid=private_google_click&gbraid=private_braid&wbraid=private_web_braid&campaignid=123&device=m&network=g`,
        { headers: original.headers },
      ),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(destination);
    expect(mocks.audit).toHaveBeenCalledOnce();
    const data = mocks.audit.mock.calls[0][0].data;
    expect(data.googleAds).toEqual({
      gclidHash: fingerprint("private_google_click"),
      gbraidHash: fingerprint("private_braid"),
      wbraidHash: fingerprint("private_web_braid"),
      campaignid: "123",
      device: "m",
      network: "g",
    });
    expect(JSON.stringify(data)).not.toContain("private_google_click");
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
      "private_google_click",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects an unknown campaign without choosing another destination", async () => {
    mocks.find.mockResolvedValue(null);
    const response = await transparentRedirect(request());
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("encodes an international next hop deterministically and audits validated/actual equality", async () => {
    mocks.find.mockResolvedValue({
      ...campaign,
      destinationDomains: [
        { hostname: "xn--bcher-kva.de", includeSubdomains: false },
      ],
    });
    const provided = "https://bücher.de/été?q=été#über";
    const target =
      "https://xn--bcher-kva.de/%C3%A9t%C3%A9?q=%C3%A9t%C3%A9#%C3%BCber";
    const response = await transparentRedirect(
      request({ destination: provided }),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(target);
    expect(mocks.audit.mock.calls[0][0].data).toMatchObject({
      providedNextHopHash: fingerprint(provided),
      validatedNextHopHash: fingerprint(target),
      actualRedirectTargetHash: fingerprint(target),
    });
  });
  it("does not depend on deferred analytics, geo or queue credentials", async () => {
    vi.stubEnv("TINYBIRD_API_KEY", "");
    vi.stubEnv("QSTASH_TOKEN", "");
    const response = await transparentRedirect(request());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(destination);
  });
  it("durably records fingerprints then returns the exact visible target and a unique click ID", async () => {
    const response = await transparentRedirect(request());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(destination);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-routeverity-click-id")).toMatch(
      /^rvc_[a-f0-9-]{36}$/,
    );
    expect(response.headers.get("server-timing")).toMatch(/redirect;dur=/);
    expect(mocks.audit).toHaveBeenCalledOnce();
    const audit = mocks.audit.mock.calls[0][0].data;
    expect(audit).toMatchObject({
      projectId: "ws_test",
      campaignId: campaign.id,
      trackingDomain: "track.example.com",
      destinationHostname: "shop.example.com",
      validationResult: "ALLOWED",
      redirectStatus: 302,
      providedNextHopHash: fingerprint(destination),
      validatedNextHopHash: fingerprint(destination),
      actualRedirectTargetHash: fingerprint(destination),
      clickId: response.headers.get("x-routeverity-click-id"),
      requestId: response.headers.get("x-routeverity-request-id"),
    });
    expect(JSON.stringify(audit)).not.toContain(destination);
    expect(JSON.stringify(audit)).not.toContain(credential.token);
    expect(audit.processingTimeMs).toBeGreaterThanOrEqual(0);
  });
  it.each([
    { "user-agent": "AdsBot-Google", "x-forwarded-for": "8.8.8.8" },
    {
      "user-agent": "Googlebot",
      cookie: "review=1",
      referer: "https://google.com",
    },
    { "user-agent": "Mobile Safari", "x-vercel-ip-country": "GB" },
    {
      "user-agent": "Mozilla Firefox",
      "x-forwarded-for": "127.0.0.1",
      cookie: "human=1",
    },
  ])(
    "does not cloak or change destinations based on visitor metadata",
    async (headers) => {
      const response = await transparentRedirect(request({ headers }));
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(destination);
    },
  );
  it.each([
    { status: "DRAFT" },
    { status: "SUSPENDED" },
    { status: "ARCHIVED" },
    { project: { disabledAt: new Date() } },
    { trackingTokenHash: null },
    { destinationDomains: [] },
    { trackingDomain: { ...campaign.trackingDomain, verified: false } },
    { trackingDomain: { ...campaign.trackingDomain, suspendedAt: new Date() } },
    { trackingDomain: { ...campaign.trackingDomain, archived: true } },
    { trackingDomain: { ...campaign.trackingDomain, type: "STANDARD_LINK" } },
    {
      trackingDomain: {
        ...campaign.trackingDomain,
        projectId: "another_workspace",
      },
    },
    { trackingDomain: null },
  ])(
    "rejects unavailable campaign/domain configuration without a fallback %j",
    async (override) => {
      mocks.find.mockResolvedValue({ ...campaign, ...override });
      const response = await transparentRedirect(request());
      expect(response.status).toBe(404);
      expect(response.headers.get("location")).toBeNull();
      expect(mocks.audit).not.toHaveBeenCalled();
    },
  );
  it.each([
    { token: issueTrackingToken().token },
    { host: "other.example.com" },
  ])("rejects a foreign credential or tracking domain", async (options) => {
    const response = await transparentRedirect(request(options));
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });
  it("applies dot-boundary destination policy, never a stored alternate target", async () => {
    const response = await transparentRedirect(
      request({ destination: "https://example.com.evil.org/path" }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each(["HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])(
    "does not mint clicks for %s",
    async (method) => {
      const response = await transparentRedirect(request({ method }));
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET");
      expect(mocks.find).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
    },
  );
  it("fails closed on rate exhaustion", async () => {
    mocks.allow.mockResolvedValue(false);
    const response = await transparentRedirect(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each(["database", "redis", "audit"])(
    "fails closed with explicit sanitized telemetry if %s is unavailable",
    async (dependency) => {
      const failure = new Error(
        `private URL ${destination} credential ${credential.token}`,
      );
      if (dependency === "database") mocks.find.mockRejectedValue(failure);
      if (dependency === "redis") mocks.allow.mockRejectedValue(failure);
      if (dependency === "audit") mocks.audit.mockRejectedValue(failure);
      const response = await transparentRedirect(request());
      expect(response.status).toBe(503);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("x-routeverity-click-id")).toBeNull();
      const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
      expect(logged).toContain("DEPENDENCY_UNAVAILABLE");
      expect(logged).not.toContain(destination);
      expect(logged).not.toContain(credential.token);
    },
  );
  it.each(["database", "redis", "audit"])(
    "bounds the response when %s stalls",
    async (dependency) => {
      vi.useFakeTimers();
      const stalled = new Promise(() => {});
      if (dependency === "database") mocks.find.mockReturnValue(stalled);
      if (dependency === "redis") mocks.allow.mockReturnValue(stalled);
      if (dependency === "audit") mocks.audit.mockReturnValue(stalled);
      const pending = transparentRedirect(request());
      await vi.advanceTimersByTimeAsync(1501);
      const response = await pending;
      expect(response.status).toBe(503);
      expect(response.headers.get("location")).toBeNull();
      expect(await response.text()).toContain("DEPENDENCY_TIMEOUT");
    },
  );
});
