import {
  deleteAccount,
  deleteWorkspace,
} from "@/lib/routeverity/deletion-actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  lockUser: vi.fn(),
  user: vi.fn(),
  lockProject: vi.fn(),
  project: vi.fn(),
  member: vi.fn(),
  owners: vi.fn(),
  receipts: vi.fn(),
  conversions: vi.fn(),
  keys: vi.fn(),
  goals: vi.fn(),
  clicks: vi.fn(),
  campaigns: vi.fn(),
  links: vi.fn(),
  domains: vi.fn(),
  defaults: vi.fn(),
  deleteProject: vi.fn(),
  detachLinks: vi.fn(),
  deleteMembers: vi.fn(),
  verification: vi.fn(),
  emailVerification: vi.fn(),
  passwordReset: vi.fn(),
  sessions: vi.fn(),
  accounts: vi.fn(),
  deleteUser: vi.fn(),
  operator: vi.fn(),
  merchantReceipts: vi.fn(),
  merchantSubmissions: vi.fn(),
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user_test" }),
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({
  allowRequest: vi.fn().mockResolvedValue(true),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));
const revision = new Date("2026-10-08T01:00:00.000Z");
function workspaceForm(address = "tenant", confirm = true) {
  const form = new FormData();
  form.set("workspaceAddress", address);
  form.set("revision", revision.toISOString());
  if (confirm) form.set("confirmDeletion", "on");
  return form;
}
function accountForm(email = "test@routeverity.test", confirm = true) {
  const form = new FormData();
  form.set("email", email);
  if (confirm) form.set("confirmDeletion", "on");
  return form;
}
const workspaceDeletes = [
  mocks.merchantReceipts,
  mocks.merchantSubmissions,
  mocks.receipts,
  mocks.conversions,
  mocks.keys,
  mocks.goals,
  mocks.clicks,
  mocks.campaigns,
  mocks.links,
  mocks.domains,
];
const accountDeletes = [
  mocks.deleteMembers,
  mocks.verification,
  mocks.emailVerification,
  mocks.passwordReset,
  mocks.sessions,
  mocks.accounts,
  mocks.deleteUser,
];
beforeEach(() => {
  vi.clearAllMocks();
  for (const operation of [
    ...workspaceDeletes,
    ...accountDeletes,
    mocks.defaults,
    mocks.detachLinks,
  ])
    operation.mockResolvedValue({ count: 1 });
  mocks.lockUser.mockResolvedValue([{ id: "user_test" }]);
  mocks.user.mockResolvedValue({
    email: "test@routeverity.test",
    emailVerified: revision,
  });
  mocks.lockProject.mockResolvedValue({ count: 1 });
  mocks.project.mockResolvedValue({ slug: "tenant" });
  mocks.member.mockResolvedValue({ role: "owner" });
  mocks.owners.mockResolvedValue(0);
  mocks.deleteProject.mockResolvedValue({});
  mocks.transaction.mockImplementation((operation) =>
    operation({
      $queryRaw: mocks.lockUser,
      user: {
        findUnique: mocks.user,
        updateMany: mocks.defaults,
        delete: mocks.deleteUser,
      },
      project: {
        updateMany: mocks.lockProject,
        findUnique: mocks.project,
        delete: mocks.deleteProject,
      },
      projectUsers: {
        findFirst: mocks.member,
        count: mocks.owners,
        deleteMany: mocks.deleteMembers,
      },
      routeVerityConversionReceipt: { deleteMany: mocks.receipts },
      routeVerityMerchantReceipt: { deleteMany: mocks.merchantReceipts },
      routeVerityMerchantSubmission: { deleteMany: mocks.merchantSubmissions },
      routeVerityConversion: { deleteMany: mocks.conversions },
      routeVerityConversionKey: { deleteMany: mocks.keys },
      routeVerityConversionGoal: { deleteMany: mocks.goals },
      routeVerityRedirectAudit: { deleteMany: mocks.clicks },
      routeVerityCampaign: { deleteMany: mocks.campaigns },
      routeVerityOperatorEvent: { deleteMany: mocks.operator },
      link: { deleteMany: mocks.links, updateMany: mocks.detachLinks },
      domain: { deleteMany: mocks.domains },
      verificationToken: { deleteMany: mocks.verification },
      emailVerificationToken: { deleteMany: mocks.emailVerification },
      passwordResetToken: { deleteMany: mocks.passwordReset },
      session: { deleteMany: mocks.sessions },
      account: { deleteMany: mocks.accounts },
    }),
  );
});

describe("owner workspace deletion", () => {
  it("requires explicit confirmation and a current revision", async () => {
    expect(
      (await deleteWorkspace("ws_test", {}, workspaceForm("tenant", false)))
        .error,
    ).toContain("confirm");
    const invalid = workspaceForm();
    invalid.set("revision", "invalid");
    expect((await deleteWorkspace("ws_test", {}, invalid)).error).toContain(
      "revision",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each(["TENANT", "tenant ", "another-tenant", ""])(
    "requires the exact address %j",
    async (address) => {
      expect(
        (await deleteWorkspace("ws_test", {}, workspaceForm(address))).error,
      ).toContain("exact workspace address");
      expect(mocks.receipts).not.toHaveBeenCalled();
      expect(mocks.deleteProject).not.toHaveBeenCalled();
    },
  );
  it.each(["member", "viewer", "billing", undefined])(
    "denies a non-owner or foreign account %j after locking",
    async (role) => {
      mocks.member.mockResolvedValue(role ? { role } : null);
      expect(
        (await deleteWorkspace("ws_test", {}, workspaceForm())).error,
      ).toContain("current owner");
      expect(mocks.deleteProject).not.toHaveBeenCalled();
    },
  );
  it("rejects stale/missing workspaces before erasure", async () => {
    mocks.lockProject.mockResolvedValue({ count: 0 });
    expect(
      (await deleteWorkspace("ws_test", {}, workspaceForm())).error,
    ).toContain("Refresh");
    expect(mocks.receipts).not.toHaveBeenCalled();
  });
  it("erases tenant data transactionally, allows suspended workspaces and retains operator evidence", async () => {
    expect(await deleteWorkspace("ws_test", {}, workspaceForm())).toEqual({
      href: "/account",
      message: "Workspace permanently deleted.",
    });
    expect(mocks.lockProject).toHaveBeenCalledWith({
      where: { id: "ws_test", updatedAt: revision },
      data: { updatedAt: expect.any(Date) },
    });
    expect(mocks.member).toHaveBeenCalledWith({
      where: { projectId: "ws_test", userId: "user_test" },
      select: { role: true },
    });
    for (const remove of workspaceDeletes)
      expect(remove).toHaveBeenCalledWith({ where: { projectId: "ws_test" } });
    expect(mocks.defaults).toHaveBeenCalledWith({
      where: { defaultWorkspace: "tenant" },
      data: { defaultWorkspace: null },
    });
    expect(mocks.deleteProject).toHaveBeenCalledWith({
      where: { id: "ws_test" },
    });
    expect(mocks.receipts.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.conversions.mock.invocationCallOrder[0],
    );
    expect(mocks.links.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.domains.mock.invocationCallOrder[0],
    );
    expect(mocks.operator).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("surfaces storage failure and never returns a deletion-shaped success", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.conversions.mockRejectedValueOnce(new Error("offline"));
    try {
      expect(
        (await deleteWorkspace("ws_test", {}, workspaceForm())).error,
      ).toContain("request failed");
      expect(mocks.deleteProject).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});

describe("account deletion without shared-workspace destruction", () => {
  it("requires confirmation before touching persistence", async () => {
    expect(
      (await deleteAccount({}, accountForm("test@routeverity.test", false)))
        .error,
    ).toContain("Confirm");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each(["TEST@routeverity.test", "different@routeverity.test", ""])(
    "requires the exact current email %j",
    async (email) => {
      expect((await deleteAccount({}, accountForm(email))).error).toContain(
        "exact current email",
      );
      expect(mocks.deleteUser).not.toHaveBeenCalled();
    },
  );
  it.each([
    null,
    { email: null, emailVerified: revision },
    { email: "test@routeverity.test", emailVerified: null },
  ])("rejects a missing or unverified current identity %j", async (user) => {
    mocks.user.mockResolvedValue(user);
    expect((await deleteAccount({}, accountForm())).error).toContain(
      "no longer available",
    );
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("blocks every owned workspace including suspended ones, without erasing anything", async () => {
    mocks.owners.mockResolvedValue(1);
    expect((await deleteAccount({}, accountForm())).error).toContain(
      "every workspace you own",
    );
    expect(mocks.owners).toHaveBeenCalledWith({
      where: { userId: "user_test", role: "owner" },
    });
    expect(mocks.detachLinks).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it("locks the user, detaches shared links and revokes live sessions/login tokens atomically", async () => {
    expect(await deleteAccount({}, accountForm())).toEqual({
      href: "/login",
    });
    expect(mocks.lockUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.owners.mock.invocationCallOrder[0],
    );
    expect(mocks.detachLinks).toHaveBeenCalledWith({
      where: { userId: "user_test" },
      data: { userId: null },
    });
    for (const remove of [
      mocks.verification,
      mocks.emailVerification,
      mocks.passwordReset,
    ])
      expect(remove).toHaveBeenCalledWith({
        where: { identifier: "test@routeverity.test" },
      });
    for (const remove of [mocks.deleteMembers, mocks.sessions, mocks.accounts])
      expect(remove).toHaveBeenCalledWith({ where: { userId: "user_test" } });
    expect(mocks.deleteUser).toHaveBeenCalledWith({
      where: { id: "user_test" },
    });
    for (const remove of workspaceDeletes)
      expect(remove).not.toHaveBeenCalled();
    expect(mocks.deleteProject).not.toHaveBeenCalled();
    expect(mocks.operator).not.toHaveBeenCalled();
  });
});
