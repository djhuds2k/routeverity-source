import {
  enrichClickBatch,
  enrichUserAgent,
} from "@/lib/routeverity/click-enrichment";
import { captureClickMetadata } from "@/lib/routeverity/click-metadata";
import {
  analyticsWhere,
  csvCell,
  parseAnalyticsFilters,
} from "@/lib/routeverity/click-reporting";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeVerityRedirectAudit: {
      findMany: mocks.find,
      updateMany: mocks.update,
    },
  },
}));
const agent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
beforeEach(() => {
  vi.resetAllMocks();
});

describe("minimal metadata capture", () => {
  it("stores bounded UA and hostname only, never referrer path/query or visitor identifiers", () => {
    const input = new Headers({
      "user-agent": agent,
      referer: "https://example.com/private?q=secret#fragment",
      "x-forwarded-for": "8.8.8.8",
      cookie: "visitor=private",
    });
    expect(captureClickMetadata(input)).toEqual({
      analyticsCaptured: true,
      rawUserAgent: agent,
      referrerHostname: "example.com",
    });
    expect(
      captureClickMetadata(new Headers({ "user-agent": "a".repeat(900) }))
        .rawUserAgent?.length,
    ).toBe(512);
  });
  it.each([
    "not a URL",
    "javascript:alert(1)",
    "https://user:password@example.com",
    "http://localhost/private",
    "https://127.0.0.1/path",
  ])("does not trust malformed or private referrer metadata %s", (referer) => {
    expect(
      captureClickMetadata(new Headers({ referer })).referrerHostname,
    ).toBeNull();
  });
  it("reports missing metadata as unavailable", () => {
    expect(captureClickMetadata(new Headers())).toEqual({
      analyticsCaptured: true,
      rawUserAgent: null,
      referrerHostname: null,
    });
  });
});
describe("async enrichment", () => {
  it("reuses Next's installed user-agent parser for coarse dimensions", () => {
    expect(enrichUserAgent(agent)).toEqual({
      device: "desktop",
      browser: "Chrome",
      operatingSystem: "Windows",
    });
    expect(enrichUserAgent(null)).toEqual({
      device: "Unknown",
      browser: "Unknown",
      operatingSystem: "Unknown",
    });
  });
  it("conditionally enriches pending events once and erases raw UA", async () => {
    mocks.find.mockResolvedValue([
      { clickId: "rvc_test", rawUserAgent: agent },
    ]);
    mocks.update
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    expect(await enrichClickBatch()).toEqual({ scanned: 1, enriched: 1 });
    expect(await enrichClickBatch()).toEqual({ scanned: 1, enriched: 0 });
    expect(mocks.update.mock.calls[0][0]).toMatchObject({
      where: { clickId: "rvc_test", analyticsCaptured: true, enrichedAt: null },
      data: {
        rawUserAgent: null,
        device: "desktop",
        browser: "Chrome",
        operatingSystem: "Windows",
      },
    });
  });
  it("does not swallow database failures or mark lost work complete", async () => {
    mocks.find.mockResolvedValue([
      { clickId: "rvc_test", rawUserAgent: agent },
    ]);
    mocks.update.mockRejectedValue(new Error("offline"));
    await expect(enrichClickBatch()).rejects.toThrow("offline");
  });
  it.each([0, -1, 501, 1.5])(
    "rejects invalid batch sizes %s",
    async (limit) => {
      await expect(enrichClickBatch(limit)).rejects.toThrow();
      expect(mocks.find).not.toHaveBeenCalled();
    },
  );
});
describe("report filters and export", () => {
  const now = new Date("2026-10-07T11:00:00Z");
  it("uses inclusive calendar-day UTC bounds and a seven-day default", () => {
    const filters = parseAnalyticsFilters({}, now);
    expect(filters.fromDate.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(filters.untilDate.toISOString()).toBe("2026-10-08T00:00:00.000Z");
    expect(analyticsWhere("ws_owned", filters)).toMatchObject({
      projectId: "ws_owned",
      timestamp: { gte: filters.fromDate, lt: filters.untilDate },
    });
  });
  it("normalizes hostnames and applies all dimensions within the tenant", () => {
    const filters = parseAnalyticsFilters(
      {
        from: "2026-10-01",
        to: "2026-10-07",
        campaign: "cmp_test",
        hostname: "EXAMPLE.COM",
        device: "mobile",
        browser: "Chrome",
        os: "Android",
      },
      now,
    );
    expect(analyticsWhere("ws_owned", filters)).toMatchObject({
      projectId: "ws_owned",
      campaignId: "cmp_test",
      destinationHostname: "example.com",
      device: "mobile",
      browser: "Chrome",
      operatingSystem: "Android",
    });
  });
  it.each([
    { from: "2026-02-30" },
    { from: "2026-10-08", to: "2026-10-07" },
    { from: "2025-01-01" },
    { campaign: ["a", "b"] },
    { page: "0" },
    { page: "-1" },
    { unknown: "ignored?" },
    { hostname: "https://example.com" },
    { browser: "a".repeat(81) },
  ])("surfaces invalid filter input %j", (input) => {
    expect(() => parseAnalyticsFilters(input, now)).toThrow();
  });
  it("quotes CSV and prevents spreadsheet formula execution", () => {
    expect(csvCell('a,"b"\nnext')).toBe('"a,""b""\nnext"');
    expect(csvCell('=HYPERLINK("evil")')).toBe('"\'=HYPERLINK(""evil"")"');
    expect(csvCell(" @SUM(A1)")).toBe('"\' @SUM(A1)"');
    expect(csvCell(null)).toBe('""');
  });
});
