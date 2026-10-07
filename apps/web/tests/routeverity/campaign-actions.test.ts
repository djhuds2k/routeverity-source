import {
  deleteCampaign,
  saveCampaign,
} from "@/lib/routeverity/campaign-actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  transaction: vi.fn(),
  projectUpdate: vi.fn(),
  domain: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  find: vi.fn(),
  remove: vi.fn(),
  deletePolicies: vi.fn(),
  createPolicies: vi.fn(),
  allow: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user_test" }),
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectUsers: { findFirst: mocks.member },
    $transaction: mocks.transaction,
  },
}));

const revision = new Date("2026-10-07T09:00:00.000Z");
const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "Summer launch",
    advertiser: "Example advertiser",
    trafficSource: "GOOGLE_ADS",
    currency: "GBP",
    status: "DRAFT",
    trackingDomainId: "",
    externalCampaignId: "",
    notes: "",
    destinationDomains: JSON.stringify([
      { hostname: "example.com", includeSubdomains: false },
    ]),
    revision: revision.toISOString(),
    utm_source: "google",
  }))
    data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ role: "owner", project: { id: "ws_test" } });
  mocks.allow.mockResolvedValue(true);
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.create.mockResolvedValue({ updatedAt: revision });
  mocks.find.mockResolvedValue({
    id: "cmp_test",
    status: "ARCHIVED",
    updatedAt: revision,
  });
  mocks.domain.mockResolvedValue({
    type: "TRANSPARENT_TRACKING",
    verified: true,
    archived: false,
    suspendedAt: null,
  });
  mocks.transaction.mockImplementation((operation) =>
    operation({
      project: { update: mocks.projectUpdate },
      domain: { findFirst: mocks.domain },
      routeVerityCampaign: {
        create: mocks.create,
        updateMany: mocks.update,
        findFirst: mocks.find,
        delete: mocks.remove,
      },
      routeVerityDestinationDomain: {
        deleteMany: mocks.deletePolicies,
        createMany: mocks.createPolicies,
      },
    }),
  );
});

describe("campaign tenant/role and configuration writes", () => {
  it.each(["viewer", "billing"])("rejects %s mutation", async (role) => {
    mocks.member.mockResolvedValue({ role, project: { id: "ws_test" } });
    expect((await saveCampaign("team", null, {}, form())).error).toContain(
      "permission",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects non-members and scopes membership to session identity", async () => {
    mocks.member.mockResolvedValue(null);
    expect(
      (await saveCampaign("foreign-team", "foreign-campaign", {}, form()))
        .error,
    ).toContain("permission");
    expect(mocks.member.mock.calls[0][0].where).toEqual({
      userId: "user_test",
      project: { slug: "foreign-team", disabledAt: null },
    });
  });
  it("scopes update to tenant and revision before replacing policies", async () => {
    expect(
      (await saveCampaign("team", "cmp_test", {}, form())).message,
    ).toContain("saved");
    expect(mocks.update.mock.calls[0][0].where).toEqual({
      id: "cmp_test",
      projectId: "ws_test",
      updatedAt: revision,
    });
    expect(mocks.createPolicies.mock.calls[0][0].data).toEqual([
      {
        campaignId: "cmp_test",
        hostname: "example.com",
        includeSubdomains: false,
      },
    ]);
  });
  it("does not replace policies after a stale or cross-tenant update", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await saveCampaign("team", "foreign", {}, form())).error).toContain(
      "changed or is unavailable",
    );
    expect(mocks.deletePolicies).not.toHaveBeenCalled();
  });
  it("requires a valid version for edits", async () => {
    const data = form();
    data.delete("revision");
    expect((await saveCampaign("team", "cmp_test", {}, data)).error).toContain(
      "version",
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("persists a draft with tenant ownership and bounded tracking parameters", async () => {
    expect((await saveCampaign("team", null, {}, form())).href).toContain(
      "/campaigns/cmp_",
    );
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      projectId: "ws_test",
      status: "DRAFT",
      trackingDomainId: null,
      trackingParameters: { utm_source: "google" },
    });
  });
  it("rejects malformed policy JSON rather than quietly accepting an empty policy", async () => {
    const data = form();
    data.set("destinationDomains", "not-json");
    expect((await saveCampaign("team", null, {}, data)).error).toContain(
      "could not be read",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects a foreign tracking domain", async () => {
    mocks.domain.mockResolvedValue(null);
    const data = form();
    data.set("trackingDomainId", "foreign-domain");
    expect((await saveCampaign("team", null, {}, data)).error).toContain(
      "belonging to this workspace",
    );
    expect(mocks.domain.mock.calls[0][0].where).toEqual({
      id: "foreign-domain",
      projectId: "ws_test",
      type: "TRANSPARENT_TRACKING",
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([
    null,
    {
      type: "TRANSPARENT_TRACKING",
      verified: false,
      suspendedAt: null,
      archived: false,
    },
    {
      type: "TRANSPARENT_TRACKING",
      verified: true,
      suspendedAt: new Date(),
      archived: false,
    },
    {
      type: "STANDARD_LINK",
      verified: true,
      suspendedAt: null,
      archived: false,
    },
  ])(
    "does not activate with an unavailable tracking domain: %j",
    async (domain) => {
      mocks.domain.mockResolvedValue(domain);
      const data = form();
      data.set("status", "ACTIVE");
      if (domain) data.set("trackingDomainId", "dom_test");
      expect((await saveCampaign("team", null, {}, data)).error).toBeTruthy();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("activates verified configuration without implementing tracking", async () => {
    const data = form();
    data.set("status", "ACTIVE");
    data.set("trackingDomainId", "dom_test");
    expect((await saveCampaign("team", null, {}, data)).href).toBeTruthy();
    expect(mocks.create.mock.calls[0][0].data.status).toBe("ACTIVE");
  });
  it("deletes only an explicitly confirmed archived campaign in the tenant", async () => {
    const data = form();
    data.set("confirm", "on");
    mocks.redirect.mockImplementationOnce((href: string) => {
      throw new Error(`Redirect: ${href}`);
    });
    await expect(deleteCampaign("team", "cmp_test", {}, data)).rejects.toThrow(
      "Redirect: /app/team/campaigns",
    );
    expect(mocks.find.mock.calls[0][0].where).toEqual({
      id: "cmp_test",
      projectId: "ws_test",
    });
    expect(mocks.deletePolicies).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
  it("does not delete without confirmation", async () => {
    expect(
      (await deleteCampaign("team", "cmp_test", {}, form())).error,
    ).toContain("Confirm");
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it.each(["DRAFT", "ACTIVE", "SUSPENDED"])(
    "requires archiving before deleting %s",
    async (status) => {
      mocks.find.mockResolvedValue({ status, updatedAt: revision });
      const data = form();
      data.set("confirm", "on");
      expect(
        (await deleteCampaign("team", "cmp_test", {}, data)).error,
      ).toContain("Archive");
      expect(mocks.deletePolicies).not.toHaveBeenCalled();
    },
  );
  it("does not delete a stale archived campaign", async () => {
    mocks.find.mockResolvedValue({ status: "ARCHIVED", updatedAt: new Date() });
    const data = form();
    data.set("confirm", "on");
    expect(
      (await deleteCampaign("team", "cmp_test", {}, data)).error,
    ).toContain("changed");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
