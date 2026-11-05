import { changeWorkspaceAvailability } from "@/lib/routeverity/operator-actions";
import { isOperator } from "@/lib/routeverity/operators";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  lock: vi.fn(),
  workspace: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user_operator" }),
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({
  allowRequest: vi.fn().mockResolvedValue(true),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.user },
    $transaction: mocks.transaction,
  },
}));

const verifiedOperator = {
  email: "operator@routeverity.test",
  emailVerified: new Date("2026-01-01"),
};
const revision = new Date("2026-01-01T00:00:00.000Z");
function form(operation = "suspend", reason = "Investigating an abuse report") {
  const data = new FormData();
  data.set("operation", operation);
  data.set("reason", reason);
  data.set("revision", revision.toISOString());
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ROUTEVERITY_OPERATOR_EMAIL", verifiedOperator.email);
  mocks.user.mockResolvedValue(verifiedOperator);
  mocks.lock.mockResolvedValue({ count: 1 });
  mocks.workspace.mockResolvedValue({ slug: "tenant", disabledAt: null });
  mocks.update.mockResolvedValue({});
  mocks.audit.mockResolvedValue({});
  mocks.transaction.mockImplementation((operation) =>
    operation({
      user: { findUnique: mocks.user },
      project: {
        updateMany: mocks.lock,
        findUnique: mocks.workspace,
        update: mocks.update,
      },
      routeVerityOperatorEvent: { create: mocks.audit },
    }),
  );
});
afterEach(() => vi.unstubAllEnvs());

describe("single verified operator", () => {
  it("disables access without configuration, without querying the database", async () => {
    vi.stubEnv("ROUTEVERITY_OPERATOR_EMAIL", undefined);
    expect(await isOperator("user_operator")).toBe(false);
    expect(mocks.user).not.toHaveBeenCalled();
    expect(
      (await changeWorkspaceAvailability("ws_test", {}, form())).error,
    ).toContain("Operator access");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("normalizes the configured email and uses current database identity", async () => {
    vi.stubEnv("ROUTEVERITY_OPERATOR_EMAIL", "  OPERATOR@routeverity.test  ");
    expect(await isOperator("user_operator")).toBe(true);
    expect(mocks.user).toHaveBeenCalledWith({
      where: { id: "user_operator" },
      select: { email: true, emailVerified: true },
    });
  });
  it.each([
    null,
    { ...verifiedOperator, emailVerified: null },
    { ...verifiedOperator, email: "member@routeverity.test" },
    { ...verifiedOperator, email: "operator@routeverity.test.evil.example" },
  ])(
    "denies missing, unverified or different accounts: %j",
    async (identity) => {
      mocks.user.mockResolvedValue(identity);
      expect(
        (await changeWorkspaceAvailability("ws_test", {}, form())).error,
      ).toContain("Operator access");
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it("surfaces malformed configuration rather than authorizing or silently hiding it", async () => {
    vi.stubEnv("ROUTEVERITY_OPERATOR_EMAIL", "not-an-email");
    await expect(isOperator("user_operator")).rejects.toThrow(
      "ROUTEVERITY_OPERATOR_EMAIL",
    );
    expect(mocks.user).not.toHaveBeenCalled();
  });
});

describe("audited emergency workspace controls", () => {
  it.each(["", " ".repeat(10), "x".repeat(501)])(
    "requires a bounded nonempty reason",
    async (reason) => {
      expect(
        (
          await changeWorkspaceAvailability(
            "ws_test",
            {},
            form("suspend", reason),
          )
        ).error,
      ).toContain("reason");
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it.each(["remove", "delete"])(
    "rejects unsupported operations: %s",
    async (operation) => {
      expect(
        (await changeWorkspaceAvailability("ws_test", {}, form(operation)))
          .error,
      ).toContain("operation");
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it("requires a valid revision", async () => {
    const data = form();
    data.set("revision", "not-a-date");
    expect(
      (await changeWorkspaceAvailability("ws_test", {}, data)).error,
    ).toContain("revision");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("suspends and appends one audit in the same transaction", async () => {
    expect(
      (await changeWorkspaceAvailability("ws_test", {}, form())).message,
    ).toContain("suspended; audit recorded");
    expect(mocks.lock).toHaveBeenCalledWith({
      where: { id: "ws_test", updatedAt: revision },
      data: { updatedAt: expect.any(Date) },
    });
    expect(
      mocks.lock.mock.calls[0][0].data.updatedAt.getTime(),
    ).toBeGreaterThan(revision.getTime());
    expect(mocks.update.mock.calls[0][0].data.disabledAt).toEqual(
      expect.any(Date),
    );
    expect(mocks.audit).toHaveBeenCalledWith({
      data: {
        id: expect.stringMatching(/^audit_/),
        projectId: "ws_test",
        actorId: "user_operator",
        operation: "WORKSPACE_SUSPENDED",
        reason: "Investigating an abuse report",
        wasDisabled: false,
        isDisabled: true,
      },
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });
  it("resumes without modifying credentials, campaigns or domains", async () => {
    mocks.workspace.mockResolvedValue({
      slug: "tenant",
      disabledAt: new Date(),
    });
    expect(
      (await changeWorkspaceAvailability("ws_test", {}, form("resume")))
        .message,
    ).toContain("resumed; audit recorded");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "ws_test" },
      data: { disabledAt: null, updatedAt: expect.any(Date) },
    });
    expect(mocks.audit.mock.calls[0][0].data).toMatchObject({
      operation: "WORKSPACE_RESUMED",
      wasDisabled: true,
      isDisabled: false,
    });
  });
  it("rejects stale or unavailable workspaces", async () => {
    mocks.lock.mockResolvedValue({ count: 0 });
    expect(
      (await changeWorkspaceAvailability("ws_test", {}, form())).error,
    ).toContain("workspace changed");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rechecks current verification after acquiring the workspace lock", async () => {
    mocks.user
      .mockResolvedValueOnce(verifiedOperator)
      .mockResolvedValue({ ...verifiedOperator, emailVerified: null });
    expect(
      (await changeWorkspaceAvailability("ws_test", {}, form())).error,
    ).toContain("no longer");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects a redundant suspension instead of creating misleading audit evidence", async () => {
    mocks.workspace.mockResolvedValue({
      slug: "tenant",
      disabledAt: new Date(),
    });
    expect(
      (await changeWorkspaceAvailability("ws_test", {}, form())).error,
    ).toContain("already suspended");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects audit-write failure so the transaction cannot commit unaudited state", async () => {
    const failure = new Error("Audit storage unavailable");
    mocks.audit.mockRejectedValueOnce(failure);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        (await changeWorkspaceAvailability("ws_test", {}, form())).error,
      ).toContain("request failed");
      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
        event: "routeverity.mutation.failed",
        error_type: "Error",
        incident_id: expect.stringMatching(/^[a-f0-9-]{36}$/),
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("Audit storage unavailable");
    } finally {
      log.mockRestore();
    }
  });
});
