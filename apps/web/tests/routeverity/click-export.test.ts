import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "../../app/app/[slug]/analytics/export/route";

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  allow: vi.fn(),
  find: vi.fn(),
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireWorkspace: mocks.workspace,
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
vi.mock("@/lib/prisma", () => ({
  prisma: { routeVerityRedirectAudit: { findMany: mocks.find } },
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.workspace.mockResolvedValue({
    workspace: { id: "ws_owned" },
    user: { id: "user_owned" },
  });
  mocks.allow.mockResolvedValue(true);
  mocks.find.mockResolvedValue([]);
});
const request = (query = "") =>
  GET(
    new Request(`https://app.example.com/app/team/analytics/export${query}`),
    { params: Promise.resolve({ slug: "team" }) },
  );
it("exports within the authenticated tenant with no raw input fields selected", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(mocks.find.mock.calls[0][0].where.projectId).toBe("ws_owned");
  expect(mocks.find.mock.calls[0][0].select.rawUserAgent).toBeUndefined();
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("rejects duplicate filters explicitly", async () => {
  expect((await request("?campaign=a&campaign=b")).status).toBe(400);
  expect(mocks.find).not.toHaveBeenCalled();
});
it("rejects oversized exports rather than silently truncating", async () => {
  mocks.find.mockResolvedValue(Array.from({ length: 10001 }));
  const response = await request();
  expect(response.status).toBe(413);
  expect(await response.text()).toContain("no partial export");
});
it("accepts exactly 10,000 rows and includes the complete CSV rather than a page", async () => {
  const row = {
    clickId: "rvc_limit",
    timestamp: new Date("2026-10-07T00:00:00Z"),
    campaignId: "cmp_test",
    trackingDomain: "track.example.com",
    destinationHostname: "example.com",
    referrerHostname: null,
    device: null,
    browser: null,
    operatingSystem: null,
    enrichedAt: null,
    analyticsCaptured: true,
    processingTimeMs: 1,
  };
  mocks.find.mockResolvedValue(Array.from({ length: 10000 }, () => row));
  const response = await request();
  expect(response.status).toBe(200);
  expect((await response.text()).split("\r\n")).toHaveLength(10001);
});
it("surfaces rate exhaustion and backend failure", async () => {
  mocks.allow.mockResolvedValueOnce(false);
  expect((await request()).status).toBe(429);
  mocks.find.mockRejectedValueOnce(new Error("private database failure"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await request()).status).toBe(503);
  expect(JSON.stringify(log.mock.calls)).toContain("export.failed");
  expect(JSON.stringify(log.mock.calls)).not.toContain("private database");
  log.mockRestore();
});
