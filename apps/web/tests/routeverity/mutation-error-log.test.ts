import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionError, perform } from "../../lib/routeverity/mutations";

const mocks = vi.hoisted(() => ({ user: vi.fn(), allow: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/routeverity/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));

describe("mutation error handling and bounded telemetry", () => {
  beforeEach(() => {
    mocks.user.mockResolvedValue({ id: "user_fixture" });
    mocks.allow.mockResolvedValue(true);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

  it("preserves success and passes only the authenticated user to the operation", async () => {
    const operation = vi.fn().mockResolvedValue({ message: "Saved" });
    await expect(perform(operation)).resolves.toEqual({ message: "Saved" });
    expect(operation).toHaveBeenCalledWith("user_fixture");
  });

  it.each([
    ["P2002", "That identifier is already registered. Choose a different one."],
    ["P2025", "This item is no longer available. Refresh the page."],
  ])("preserves %s public handling without printing raw Prisma errors", async (code, message) => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Prisma.PrismaClientKnownRequestError("SYNTHETIC_PRIVATE_VALUE", {
      code, clientVersion: "fixture", meta: { private: "SYNTHETIC_PRIVATE_VALUE" },
    });
    await expect(perform(async () => { throw error; })).resolves.toEqual({ error: message });
    expect(output).not.toHaveBeenCalled();
  });

  it("drops raw unexpected error details while preserving the generic response", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sentinel = "SYNTHETIC_PRIVATE_VALUE";
    await expect(perform(async () => {
      throw new Error(sentinel, { cause: { query: sentinel, token: sentinel } });
    })).resolves.toEqual({ error: "The request failed. Please retry, or check the application logs." });
    expect(output).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(output.mock.calls)).not.toContain(sentinel);
    expect(JSON.parse(String(output.mock.calls[0][0]))).toEqual({
      event: "routeverity.mutation.failed", error_type: "Error",
      incident_id: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
  });

  it("preserves expected ActionError handling without error telemetry", async () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(perform(async () => { throw new ActionError("Invalid policy"); }))
      .resolves.toEqual({ error: "Invalid policy" });
    expect(output).not.toHaveBeenCalled();
  });

  it("does not run the operation when rate limited", async () => {
    mocks.allow.mockResolvedValue(false);
    const operation = vi.fn();
    await expect(perform(operation)).resolves.toEqual({ error: "Too many requests. Please wait a minute." });
    expect(operation).not.toHaveBeenCalled();
  });

  it("keeps authentication failures outside the mutation catch", async () => {
    const authFailure = new Error("fixture auth redirect");
    mocks.user.mockRejectedValue(authFailure);
    const operation = vi.fn();
    await expect(perform(operation)).rejects.toBe(authFailure);
    expect(operation).not.toHaveBeenCalled();
  });
});
