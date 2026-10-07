import { changeDomain } from "@/lib/routeverity/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dns: vi.fn(),
  update: vi.fn(),
  lock: vi.fn(),
  member: vi.fn(),
  domain: vi.fn(),
  resolver: vi.fn(),
}));
vi.mock("node:dns/promises", () => ({
  Resolver: mocks.resolver,
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user_test" }),
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({
  allowRequest: vi.fn().mockResolvedValue(true),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectUsers: { findFirst: mocks.member },
    domain: { findFirst: mocks.domain },
    $transaction: (operation: (transaction: object) => Promise<unknown>) =>
      operation({
        project: { updateMany: mocks.lock },
        projectUsers: { findFirst: mocks.member },
        domain: { updateMany: mocks.update },
      }),
  },
}));

const domain = {
  id: "dom_test",
  projectId: "ws_test",
  slug: "links.example.com",
  type: "STANDARD_LINK",
  verified: true,
  verificationToken: "test-token",
  suspendedAt: null,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("manual domain verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dns.mockReset();
    mocks.resolver.mockImplementation(function () {
      return { resolveTxt: mocks.dns };
    });
    mocks.lock.mockResolvedValue({ count: 1 });
    mocks.update.mockResolvedValue({ count: 1 });
    mocks.member.mockResolvedValue({
      role: "owner",
      project: { id: "ws_test" },
    });
    mocks.domain.mockResolvedValue(domain);
  });
  it("clears previously verified status when the ownership TXT record disappears", async () => {
    mocks.dns.mockRejectedValue(
      Object.assign(new Error("No TXT record"), { code: "ENODATA" }),
    );
    expect(
      (await changeDomain("team", "dom_test", "verify", {})).error,
    ).toContain("TXT record not found");
    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "dom_test",
        projectId: "ws_test",
        slug: domain.slug,
        type: domain.type,
        verificationToken: domain.verificationToken,
        updatedAt: domain.updatedAt,
      },
      data: {
        verified: false,
        lastChecked: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    });
  });
  it("rejects a mismatching TXT value and clears verified status", async () => {
    mocks.dns.mockResolvedValue([["routeverity-verification=wrong-token"]]);
    expect(
      (await changeDomain("team", "dom_test", "verify", {})).error,
    ).toContain("did not match");
    expect(mocks.update.mock.calls[0][0].data.verified).toBe(false);
  });
  it("joins split DNS TXT strings and records a real matching result", async () => {
    mocks.dns.mockResolvedValue([["routeverity-", "verification=test-token"]]);
    expect((await changeDomain("team", "dom_test", "verify", {})).message).toBe(
      "Domain verified.",
    );
    expect(mocks.dns).toHaveBeenCalledWith("_routeverity.links.example.com");
    expect(mocks.update.mock.calls[0][0].data.verified).toBe(true);
  });
  it("can confirm ownership without resuming a suspended domain", async () => {
    mocks.domain.mockResolvedValue({ ...domain, suspendedAt: new Date() });
    mocks.dns.mockResolvedValue([["routeverity-verification=test-token"]]);
    expect((await changeDomain("team", "dom_test", "verify", {})).message).toBe(
      "Domain verified.",
    );
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty(
      "suspendedAt",
    );
  });
  it("advances revisions even when the clock has not passed the previous update", async () => {
    const future = new Date(Date.now() + 60000);
    mocks.domain.mockResolvedValue({ ...domain, updatedAt: future });
    expect(
      (await changeDomain("team", "dom_test", "suspend", {})).message,
    ).toBeTruthy();
    expect(mocks.update.mock.calls[0][0].data.updatedAt.getTime()).toBe(
      future.getTime() + 1,
    );
  });
  it("bounds the DNS resolver and leaves ownership unchanged on timeout", async () => {
    mocks.dns.mockRejectedValue(
      Object.assign(new Error("Timeout"), { code: "ETIMEOUT" }),
    );
    expect(
      (await changeDomain("team", "dom_test", "verify", {})).error,
    ).toContain("timed out");
    expect(mocks.resolver).toHaveBeenCalledWith({ timeout: 2000, tries: 1 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([0, 1])(
    "blocks a DNS result when workspace or permission changed (%s)",
    async (permissionChanged) => {
      mocks.dns.mockResolvedValue([["routeverity-verification=test-token"]]);
      if (permissionChanged) {
        mocks.member
          .mockResolvedValueOnce({ role: "owner", project: { id: "ws_test" } })
          .mockResolvedValue({ role: "viewer" });
      } else {
        mocks.lock.mockResolvedValue({ count: 0 });
      }
      expect(
        (await changeDomain("team", "dom_test", "verify", {})).error,
      ).toBeTruthy();
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );
  it("rejects stale results after a domain was changed, removed or reassigned", async () => {
    mocks.dns.mockResolvedValue([["routeverity-verification=test-token"]]);
    mocks.update.mockResolvedValue({ count: 0 });
    expect(
      (await changeDomain("team", "dom_test", "verify", {})).error,
    ).toContain("domain changed");
    expect(mocks.update.mock.calls[0][0].where).toMatchObject({
      projectId: "ws_test",
      verificationToken: domain.verificationToken,
      updatedAt: domain.updatedAt,
    });
  });
  it("rejects stale negative DNS results instead of clearing a newer verification", async () => {
    mocks.dns.mockRejectedValue(
      Object.assign(new Error("No TXT"), { code: "ENODATA" }),
    );
    mocks.update.mockResolvedValue({ count: 0 });
    expect(
      (await changeDomain("team", "dom_test", "verify", {})).error,
    ).toContain("domain changed");
  });
  it("surfaces unexpected DNS failures without changing ownership", async () => {
    const error = Object.assign(new Error("Resolver failed"), {
      code: "ESERVFAIL",
    });
    mocks.dns.mockRejectedValue(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        (await changeDomain("team", "dom_test", "verify", {})).error,
      ).toContain("request failed");
      expect(log).toHaveBeenCalledWith("RouteVerity mutation failed", error);
      expect(mocks.update).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it.each(["suspend", "resume"] as const)(
    "serializes %s and advances the domain revision",
    async (operation) => {
      expect(
        (await changeDomain("team", "dom_test", operation, {})).message,
      ).toBe(`Domain ${operation === "suspend" ? "suspended" : "resumed"}.`);
      expect(mocks.lock).toHaveBeenCalledWith({
        where: { id: "ws_test", disabledAt: null },
        data: { updatedAt: expect.any(Date) },
      });
      const data = mocks.update.mock.calls[0][0].data;
      expect(data.updatedAt.getTime()).toBeGreaterThan(
        domain.updatedAt.getTime(),
      );
      expect(data.suspendedAt).toEqual(
        operation === "suspend" ? expect.any(Date) : null,
      );
    },
  );
  it("rejects stale suspension rather than overwriting another domain operation", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect(
      (await changeDomain("team", "dom_test", "resume", {})).error,
    ).toContain("domain changed");
  });
  it("does not query DNS for a development domain", async () => {
    mocks.domain.mockResolvedValue({ ...domain, type: "DEVELOPMENT" });
    expect(
      (await changeDomain("team", "dom_test", "verify", {})).error,
    ).toContain("Development domains");
    expect(mocks.dns).not.toHaveBeenCalled();
  });
});
