import {
  dataExportResponse,
  encodeDataExport,
  exportAccount,
  exportByteLimit,
  exportWorkspace,
} from "@/lib/routeverity/data-export";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  currentUser: vi.fn(),
  member: vi.fn(),
  workspace: vi.fn(),
  user: vi.fn(),
  memberships: vi.fn(),
  domains: vi.fn(),
  links: vi.fn(),
  campaigns: vi.fn(),
  policies: vi.fn(),
  clicks: vi.fn(),
  goals: vi.fn(),
  conversions: vi.fn(),
  keys: vi.fn(),
  sessions: vi.fn(),
  providers: vi.fn(),
  allow: vi.fn(),
  merchantSubmissions: vi.fn(),
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireUser: mocks.currentUser,
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));
const collections = [
  mocks.memberships,
  mocks.domains,
  mocks.links,
  mocks.campaigns,
  mocks.policies,
  mocks.clicks,
  mocks.goals,
  mocks.conversions,
  mocks.keys,
  mocks.merchantSubmissions,
];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentUser.mockResolvedValue({ id: "user_owned" });
  mocks.allow.mockResolvedValue(true);
  mocks.member.mockResolvedValue({ role: "owner", projectId: "ws_owned" });
  mocks.workspace.mockResolvedValue({
    id: "ws_owned",
    slug: "owned",
    disabledAt: null,
  });
  mocks.user.mockResolvedValue({
    id: "user_owned",
    email: "owned@routeverity.test",
  });
  for (const find of [...collections, mocks.sessions, mocks.providers])
    find.mockResolvedValue([]);
  mocks.transaction.mockImplementation((operation) =>
    operation({
      projectUsers: { findFirst: mocks.member, findMany: mocks.memberships },
      project: { findUnique: mocks.workspace },
      user: { findUnique: mocks.user },
      domain: { findMany: mocks.domains },
      link: { findMany: mocks.links },
      routeVerityCampaign: { findMany: mocks.campaigns },
      routeVerityDestinationDomain: { findMany: mocks.policies },
      routeVerityRedirectAudit: { findMany: mocks.clicks },
      routeVerityConversionGoal: { findMany: mocks.goals },
      routeVerityConversion: { findMany: mocks.conversions },
      routeVerityConversionKey: { findMany: mocks.keys },
      routeVerityMerchantSubmission: { findMany: mocks.merchantSubmissions },
      session: { findMany: mocks.sessions },
      account: { findMany: mocks.providers },
    }),
  );
});
function response(slug?: string, query = "") {
  return dataExportResponse(
    new Request(`https://app.example.com/export${query}`),
    slug,
  );
}

describe("owner-only complete workspace export", () => {
  it.each(["member", "viewer", "billing", undefined])(
    "denies %j without querying workspace records",
    async (role) => {
      mocks.member.mockResolvedValue(
        role ? { role, projectId: "ws_owned" } : null,
      );
      expect((await response("foreign")).status).toBe(403);
      for (const find of collections) expect(find).not.toHaveBeenCalled();
      expect(mocks.member).toHaveBeenCalledWith({
        where: { userId: "user_owned", project: { slug: "foreign" } },
        select: { role: true, projectId: true },
      });
    },
  );
  it("exports complete retained scope in a repeatable snapshot, not a reporting page", async () => {
    mocks.clicks.mockResolvedValue([
      { clickId: "rvc_owned", timestamp: new Date("2026-10-08T00:00:00Z") },
    ]);
    mocks.conversions.mockResolvedValue([
      {
        id: "cnv_owned",
        revenue: new Prisma.Decimal("0.100"),
        metadata: { reference: "customer-supplied" },
      },
    ]);
    const output = await response("owned");
    expect(output.status).toBe(200);
    expect(output.headers.get("content-type")).toContain("application/json");
    expect(output.headers.get("content-disposition")).toBe(
      'attachment; filename="routeverity-workspace.json"',
    );
    expect(output.headers.get("cache-control")).toContain("no-store");
    const data = await output.json();
    expect(Object.keys(data)).toEqual([
      "schemaVersion",
      "scope",
      "exportedAt",
      "notice",
      "workspace",
      "memberships",
      "domains",
      "links",
      "campaigns",
      "destinationPolicies",
      "clickAudits",
      "goals",
      "conversions",
      "conversionKeyMetadata",
      "merchantSubmissions",
    ]);
    expect(data.schemaVersion).toBe("routeverity-export-v1");
    expect(data.scope).toBe("workspace");
    expect(data.clickAudits[0].timestamp).toBe("2026-10-08T00:00:00.000Z");
    expect(data.conversions[0].revenue).toBe("0.1");
    expect(data.conversions[0].metadata).toEqual({
      reference: "customer-supplied",
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 10000,
    });
    for (const find of collections) {
      expect(find.mock.calls[0][0].take).toBe(10001);
      expect(find.mock.calls[0][0].orderBy).toBeDefined();
    }
    for (const find of collections.filter((find) => find !== mocks.policies))
      expect(find.mock.calls[0][0].where).toEqual({ projectId: "ws_owned" });
    expect(mocks.policies.mock.calls[0][0].where).toEqual({
      campaign: { projectId: "ws_owned" },
    });
  });
  it("permits a suspended owner to export before erasing the workspace", async () => {
    mocks.workspace.mockResolvedValue({
      id: "ws_owned",
      slug: "owned",
      disabledAt: new Date(),
    });
    expect((await response("owned")).status).toBe(200);
    expect(mocks.member.mock.calls[0][0].where.project).toEqual({
      slug: "owned",
    });
  });
  it("never selects credential fields, raw UA, other members' emails or internal dedupe hashes", async () => {
    await exportWorkspace("user_owned", "owned");
    const selects = collections.map((find) => find.mock.calls[0][0].select);
    for (const select of selects) {
      for (const field of [
        "tokenHash",
        "trackingTokenHash",
        "verificationToken",
        "rawUserAgent",
        "passwordHash",
        "sessionToken",
        "email",
        "orderHash",
        "payloadHash",
        "keyHash",
        "gclidHash",
        "credentialId",
      ])
        expect(select[field]).toBeUndefined();
    }
    expect(mocks.sessions).not.toHaveBeenCalled();
    expect(mocks.providers).not.toHaveBeenCalled();
  });
  it.each(collections.map((_, index) => index))(
    "fails explicitly for oversized collection %s",
    async (index) => {
      collections[index].mockResolvedValue(
        Array(10001).fill({ id: "bounded-test" }),
      );
      const output = await response("owned");
      expect(output.status).toBe(413);
      expect(await output.text()).toContain("No partial export");
    },
  );
  it("accepts exactly 10,000 records without silently removing any", async () => {
    mocks.clicks.mockResolvedValue(Array(10000).fill({ clickId: "rvc_limit" }));
    const data = await exportWorkspace("user_owned", "owned");
    expect(data.clickAudits).toHaveLength(10000);
  });
});

describe("personal account export", () => {
  it("scopes every collection to the current account without full shared-workspace content", async () => {
    const output = await response();
    expect(output.status).toBe(200);
    expect(output.headers.get("content-disposition")).toBe(
      'attachment; filename="routeverity-account.json"',
    );
    const data = await output.json();
    expect(Object.keys(data)).toEqual([
      "schemaVersion",
      "scope",
      "exportedAt",
      "notice",
      "user",
      "memberships",
      "sessions",
      "signInProviders",
      "authoredLinkReferences",
    ]);
    for (const find of [
      mocks.memberships,
      mocks.sessions,
      mocks.providers,
      mocks.links,
    ]) {
      expect(find.mock.calls[0][0].where).toEqual({ userId: "user_owned" });
      expect(find.mock.calls[0][0].take).toBe(10001);
    }
    expect(mocks.user).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user_owned" } }),
    );
    expect(mocks.links.mock.calls[0][0].select.url).toBeUndefined();
    expect(mocks.sessions.mock.calls[0][0].select.sessionToken).toBeUndefined();
    const providerSelect = mocks.providers.mock.calls[0][0].select;
    expect(providerSelect.access_token).toBeUndefined();
    expect(providerSelect.refresh_token).toBeUndefined();
    expect(providerSelect.id_token).toBeUndefined();
    expect(mocks.user.mock.calls[0][0].select.passwordHash).toBeUndefined();
    expect(mocks.clicks).not.toHaveBeenCalled();
    expect(mocks.conversions).not.toHaveBeenCalled();
  });
  it("rejects a deleted account explicitly", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await response()).status).toBe(404);
    expect(mocks.links).not.toHaveBeenCalled();
  });
  it("does not truncate personal account collections", async () => {
    mocks.sessions.mockResolvedValue(
      Array(10001).fill({ id: "session_limit" }),
    );
    await expect(exportAccount("user_owned")).rejects.toMatchObject({
      status: 413,
    });
  });
});

describe("download limits and dependency failures", () => {
  it("measures the exact UTF-8 byte boundary including JSON framing", () => {
    expect(
      Buffer.byteLength(
        encodeDataExport("x".repeat(exportByteLimit - 2)),
        "utf8",
      ),
    ).toBe(exportByteLimit);
    expect(() => encodeDataExport("x".repeat(exportByteLimit - 1))).toThrow(
      "20 MiB",
    );
    expect(() => encodeDataExport("é".repeat(exportByteLimit / 2))).toThrow(
      "20 MiB",
    );
  });
  it("rejects query parameters instead of pretending to honor filters", async () => {
    expect((await response("owned", "?limit=1")).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("shares rate limiting across account/workspace downloads", async () => {
    mocks.allow.mockResolvedValue(false);
    expect((await response("owned")).status).toBe(429);
    expect(mocks.allow).toHaveBeenCalledWith(
      "data-export",
      "user_owned",
      10,
      60,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("surfaces DB failure without leaking values or returning an empty archive", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.conversions.mockRejectedValueOnce(
      new Error("private database connection detail"),
    );
    try {
      const output = await response("owned");
      expect(output.status).toBe(503);
      expect(await output.text()).not.toContain("private database");
      expect(JSON.stringify(log.mock.calls)).toContain("data.export.failed");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private database");
    } finally {
      log.mockRestore();
    }
  });
});
