import { changeDomain } from "@/lib/routeverity/actions";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectLock: vi.fn(),
  domainLock: vi.fn(),
  references: vi.fn(),
  links: vi.fn(),
  remove: vi.fn(),
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
    projectUsers: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ role: "owner", project: { id: "ws_test" } }),
    },
    domain: {
      findFirst: vi.fn().mockResolvedValue({
        id: "dom_test",
        slug: "track.example.com",
        type: "TRANSPARENT_TRACKING",
        verificationToken: "test-token",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    },
    $transaction: (operation: (transaction: object) => Promise<unknown>) =>
      operation({
        project: { updateMany: mocks.projectLock },
        projectUsers: {
          findFirst: vi.fn().mockResolvedValue({ role: "owner" }),
        },
        domain: { updateMany: mocks.domainLock, delete: mocks.remove },
        routeVerityCampaign: { count: mocks.references },
        link: { count: mocks.links },
      }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.references.mockResolvedValue(0);
  mocks.links.mockResolvedValue(0);
  mocks.projectLock.mockResolvedValue({ count: 1 });
  mocks.domainLock.mockResolvedValue({ count: 1 });
});

it("does not remove domains assigned to campaigns", async () => {
  mocks.references.mockResolvedValue(1);
  expect(
    (await changeDomain("team", "dom_test", "remove", {})).error,
  ).toContain("Unassign this domain");
  expect(mocks.references).toHaveBeenCalledWith({
    where: { trackingDomainId: "dom_test" },
  });
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("retains the existing link-removal guard after checking campaign references", async () => {
  mocks.links.mockResolvedValue(1);
  expect(
    (await changeDomain("team", "dom_test", "remove", {})).error,
  ).toContain("Remove the domain's links");
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("allows removal only after serialized checks find no references", async () => {
  expect((await changeDomain("team", "dom_test", "remove", {})).message).toBe(
    "Domain removed.",
  );
  expect(mocks.projectLock).toHaveBeenCalledWith({
    where: { id: "ws_test", disabledAt: null },
    data: { updatedAt: expect.any(Date) },
  });
  expect(mocks.remove).toHaveBeenCalledWith({ where: { id: "dom_test" } });
});

it("does not remove a domain from a newly disabled workspace", async () => {
  mocks.projectLock.mockResolvedValue({ count: 0 });
  expect(
    (await changeDomain("team", "dom_test", "remove", {})).error,
  ).toContain("Workspace unavailable");
  expect(mocks.domainLock).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("does not remove a changed or reassigned domain", async () => {
  mocks.domainLock.mockResolvedValue({ count: 0 });
  expect(
    (await changeDomain("team", "dom_test", "remove", {})).error,
  ).toContain("domain changed");
  expect(mocks.remove).not.toHaveBeenCalled();
});
