import {
  createConversionApiKey,
  createConversionGoal,
  revokeConversionApiKey,
  setConversionGoalEnabled,
} from "@/lib/routeverity/conversion-actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  member: vi.fn(),
  allow: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  campaign: vi.fn(),
  goal: vi.fn(),
  goalUpdate: vi.fn(),
  count: vi.fn(),
  key: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireUser: mocks.user,
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectUsers: { findFirst: mocks.member },
    $transaction: mocks.transaction,
  },
}));
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
const keyForm = () => form({ name: "Merchant server", confirm: "on" });
const goalForm = () =>
  form({
    campaignId: "cmp_owned",
    name: "Purchase",
    event: "purchase",
    currency: "GBP",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "user_test" });
  mocks.member.mockResolvedValue({
    role: "owner",
    project: { id: "ws_owned" },
  });
  mocks.allow.mockResolvedValue(true);
  mocks.lock.mockResolvedValue({ count: 1 });
  mocks.campaign.mockResolvedValue({ id: "cmp_owned" });
  mocks.goalUpdate.mockResolvedValue({ count: 1 });
  mocks.revoke.mockResolvedValue({ count: 1 });
  mocks.count.mockResolvedValue(0);
  mocks.transaction.mockImplementation((operation) =>
    operation({
      project: { updateMany: mocks.lock },
      routeVerityCampaign: { findFirst: mocks.campaign },
      routeVerityConversionGoal: {
        create: mocks.goal,
        updateMany: mocks.goalUpdate,
      },
      routeVerityConversionKey: {
        count: mocks.count,
        create: mocks.key,
        updateMany: mocks.revoke,
      },
    }),
  );
});
describe("conversion role and key configuration", () => {
  it.each(["viewer", "billing"])("denies all %s writes", async (role) => {
    mocks.member.mockResolvedValue({ role, project: { id: "ws_owned" } });
    for (const result of [
      await createConversionGoal("team", {}, goalForm()),
      await createConversionApiKey("team", {}, keyForm()),
      await revokeConversionApiKey("team", "foreign", {}, keyForm()),
      await setConversionGoalEnabled(
        "team",
        "foreign",
        false,
        {},
        new FormData(),
      ),
    ])
      expect(result.error).toContain("permission");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("allows a member to create an owned immutable goal", async () => {
    mocks.member.mockResolvedValue({
      role: "member",
      project: { id: "ws_owned" },
    });
    expect(
      (await createConversionGoal("team", {}, goalForm())).message,
    ).toContain("immutable");
    expect(mocks.campaign.mock.calls[0][0].where).toEqual({
      id: "cmp_owned",
      projectId: "ws_owned",
    });
    expect(mocks.goal.mock.calls[0][0].data).toMatchObject({
      projectId: "ws_owned",
      event: "purchase",
      currency: "GBP",
    });
  });
  it("rejects foreign campaigns and scope-checks goal switches", async () => {
    mocks.campaign.mockResolvedValue(null);
    expect(
      (await createConversionGoal("team", {}, goalForm())).error,
    ).toContain("not found");
    expect(mocks.goal).not.toHaveBeenCalled();
    mocks.goalUpdate.mockResolvedValue({ count: 0 });
    expect(
      (
        await setConversionGoalEnabled(
          "team",
          "foreign",
          false,
          {},
          new FormData(),
        )
      ).error,
    ).toContain("not found");
    expect(mocks.goalUpdate.mock.calls[0][0].where).toEqual({
      id: "foreign",
      projectId: "ws_owned",
    });
  });
  it("allows the fifth key but not the sixth and persists no raw secret", async () => {
    mocks.count.mockResolvedValue(4);
    const result = await createConversionApiKey("team", {}, keyForm());
    expect(result.conversionKey).toMatch(/^rvcv_/);
    expect(mocks.key.mock.calls[0][0].data).toMatchObject({
      projectId: "ws_owned",
      name: "Merchant server",
    });
    expect(JSON.stringify(mocks.key.mock.calls)).not.toContain(
      result.conversionKey,
    );
    mocks.count.mockResolvedValue(5);
    expect(
      (await createConversionApiKey("team", {}, keyForm())).error,
    ).toContain("five");
    expect(mocks.key).toHaveBeenCalledOnce();
  });
  it("requires confirmation and scopes revocation to the current tenant and active key", async () => {
    expect(
      (await revokeConversionApiKey("team", "key", {}, new FormData())).error,
    ).toContain("Confirm");
    expect(
      (await revokeConversionApiKey("team", "key", {}, keyForm())).message,
    ).toContain("revoked");
    expect(mocks.revoke.mock.calls[0][0].where).toEqual({
      id: "key",
      projectId: "ws_owned",
      revokedAt: null,
    });
  });
  it("rechecks enabled workspace inside the transaction", async () => {
    mocks.lock.mockResolvedValue({ count: 0 });
    expect(
      (await createConversionApiKey("team", {}, keyForm())).error,
    ).toContain("unavailable");
    expect(mocks.key).not.toHaveBeenCalled();
  });
});
