import { manageTrackingCredential } from "@/lib/routeverity/tracking-credentials";
import { tokenMatches } from "@/lib/routeverity/transparent-policy";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  project: vi.fn(),
  allow: vi.fn(),
  transaction: vi.fn(),
  user: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectUsers: { findFirst: mocks.member },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireUser: mocks.user,
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const revision = new Date("2026-10-07T10:00:00Z");
const confirmed = () => {
  const form = new FormData();
  form.set("confirm", "on");
  return form;
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "user_test" });
  mocks.member.mockResolvedValue({ role: "owner", project: { id: "ws_test" } });
  mocks.find.mockResolvedValue({
    trackingDomainId: "dom_test",
    updatedAt: revision,
  });
  mocks.allow.mockResolvedValue(true);
  mocks.transaction.mockImplementation((operation) =>
    operation({
      project: { update: mocks.project },
      routeVerityCampaign: { findFirst: mocks.find, update: mocks.update },
    }),
  );
});
it("issues only a hash in the owned campaign and reveals the credential once without changing the policy revision", async () => {
  const result = await manageTrackingCredential(
    "team",
    "cmp_test",
    "ISSUE",
    {},
    confirmed(),
  );
  expect(result.trackingToken).toMatch(/^rvt_[A-Za-z0-9_-]{43}$/);
  const data = mocks.update.mock.calls[0][0].data;
  expect(tokenMatches(result.trackingToken ?? "", data.trackingTokenHash)).toBe(
    true,
  );
  expect(data.updatedAt).toBe(revision);
  expect(JSON.stringify(data)).not.toContain(result.trackingToken);
  expect(mocks.find.mock.calls[0][0].where).toEqual({
    id: "cmp_test",
    projectId: "ws_test",
  });
});
it("revokes without returning a replacement secret", async () => {
  const result = await manageTrackingCredential(
    "team",
    "cmp_test",
    "REVOKE",
    {},
    confirmed(),
  );
  expect(result.trackingToken).toBeUndefined();
  expect(mocks.update.mock.calls[0][0].data).toMatchObject({
    trackingTokenHash: null,
    trackingTokenIssuedAt: null,
  });
});
it.each(["viewer", "billing"])(
  "prevents %s credential management",
  async (role) => {
    mocks.member.mockResolvedValue({ role, project: { id: "ws_test" } });
    expect(
      (
        await manageTrackingCredential(
          "team",
          "cmp_test",
          "ISSUE",
          {},
          confirmed(),
        )
      ).error,
    ).toContain("permission");
    expect(mocks.update).not.toHaveBeenCalled();
  },
);
it("requires explicit confirmation", async () => {
  expect(
    (
      await manageTrackingCredential(
        "team",
        "cmp_test",
        "ISSUE",
        {},
        new FormData(),
      )
    ).error,
  ).toContain("Confirm");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("does not issue for another tenant or an unassigned campaign", async () => {
  mocks.find.mockResolvedValueOnce(null);
  expect(
    (
      await manageTrackingCredential(
        "team",
        "cmp_foreign",
        "ISSUE",
        {},
        confirmed(),
      )
    ).error,
  ).toContain("not found");
  mocks.find.mockResolvedValueOnce({ trackingDomainId: null });
  expect(
    (
      await manageTrackingCredential(
        "team",
        "cmp_test",
        "ISSUE",
        {},
        confirmed(),
      )
    ).error,
  ).toContain("Assign");
  expect(mocks.update).not.toHaveBeenCalled();
});
