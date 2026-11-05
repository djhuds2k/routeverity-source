import {
  addDomain,
  createLink,
  createWorkspace,
  deleteLink,
  saveWorkspace,
} from "@/lib/routeverity/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  user: vi.fn(),
  project: vi.fn(),
  projectCreate: vi.fn(),
  projectLock: vi.fn(),
  domainCreate: vi.fn(),
  domainCount: vi.fn(),
  domainFind: vi.fn(),
  domainLock: vi.fn(),
  linkCreate: vi.fn(),
  linkDelete: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  allow: vi.fn(),
  authorLock: vi.fn(),
}));
vi.mock("@/lib/routeverity/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user_test" }),
}));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectUsers: { findFirst: mocks.member },
    project: { update: mocks.project },
    $transaction: mocks.transaction,
  },
}));

const workspace = {
  id: "ws_test",
  slug: "team",
  linksLimit: 25,
  domainsLimit: 3,
};
const form = () => {
  const data = new FormData();
  data.set("domainId", "dom_test");
  data.set("key", "hello");
  data.set("url", "https://example.com");
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_URL = "http://localhost:8888";
  mocks.allow.mockResolvedValue(true);
  mocks.authorLock.mockResolvedValue([{ id: "user_test" }]);
  mocks.member.mockResolvedValue({ role: "owner", project: workspace });
  mocks.project.mockResolvedValue({ ...workspace, totalLinks: 1 });
  mocks.projectLock.mockResolvedValue({ count: 1 });
  mocks.domainCount.mockResolvedValue(0);
  mocks.domainFind.mockResolvedValue({
    id: "dom_test",
    slug: "test.localhost",
    type: "DEVELOPMENT",
    verified: true,
    suspendedAt: null,
  });
  mocks.domainLock.mockResolvedValue({ count: 1 });
  mocks.linkDelete.mockResolvedValue({ count: 1 });
  mocks.count.mockResolvedValue(0);
  mocks.transaction.mockImplementation((operation) =>
    operation({
      $queryRaw: mocks.authorLock,
      user: { update: mocks.user },
      project: {
        update: mocks.project,
        create: mocks.projectCreate,
        updateMany: mocks.projectLock,
      },
      projectUsers: { count: mocks.count, findFirst: mocks.member },
      domain: {
        findFirst: mocks.domainFind,
        updateMany: mocks.domainLock,
        count: mocks.domainCount,
        create: mocks.domainCreate,
      },
      link: { create: mocks.linkCreate, deleteMany: mocks.linkDelete },
    }),
  );
});

describe("tenant-scoped writes", () => {
  it("rejects a deleted author before creating a link or touching a workspace", async () => {
    mocks.authorLock.mockResolvedValue([]);
    expect((await createLink("team", {}, form())).error).toContain(
      "account is unavailable",
    );
    expect(mocks.project).not.toHaveBeenCalled();
    expect(mocks.linkCreate).not.toHaveBeenCalled();
  });
  it("rechecks membership after obtaining the workspace lock", async () => {
    mocks.member
      .mockResolvedValueOnce({ role: "member", project: workspace })
      .mockResolvedValueOnce(null);
    expect((await createLink("team", {}, form())).error).toContain("no longer");
    expect(mocks.linkCreate).not.toHaveBeenCalled();
  });
  it("creates an unverified custom tracking domain under the workspace lock", async () => {
    const data = new FormData();
    data.set("slug", "track.example.com");
    data.set("type", "TRANSPARENT_TRACKING");
    expect((await addDomain("team", {}, data)).message).toContain(
      "Publish the TXT",
    );
    expect(mocks.projectLock).toHaveBeenCalledWith({
      where: { id: "ws_test", disabledAt: null },
      data: { updatedAt: expect.any(Date) },
    });
    expect(mocks.domainCreate.mock.calls[0][0].data).toMatchObject({
      projectId: "ws_test",
      slug: "track.example.com",
      type: "TRANSPARENT_TRACKING",
      verificationToken: expect.stringMatching(/^[a-f0-9]{48}$/),
    });
  });
  it("does not add a domain after the workspace becomes disabled", async () => {
    mocks.projectLock.mockResolvedValue({ count: 0 });
    const data = new FormData();
    data.set("slug", "track.example.com");
    data.set("type", "TRANSPARENT_TRACKING");
    expect((await addDomain("team", {}, data)).error).toContain(
      "Workspace unavailable",
    );
    expect(mocks.domainCreate).not.toHaveBeenCalled();
  });
  it("enforces the custom-domain ceiling under the workspace lock", async () => {
    mocks.domainCount.mockResolvedValue(3);
    const data = new FormData();
    data.set("slug", "track.example.com");
    data.set("type", "TRANSPARENT_TRACKING");
    expect((await addDomain("team", {}, data)).error).toContain(
      "3 custom domains",
    );
    expect(mocks.domainCreate).not.toHaveBeenCalled();
  });
  it.each(["viewer", "billing"])(
    "rejects %s writes without touching persistence",
    async (role) => {
      mocks.member.mockResolvedValue({ role, project: workspace });
      expect(await createLink("team", {}, form())).toHaveProperty(
        "error",
        "You do not have permission to change this workspace.",
      );
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it("rejects a non-member and scopes membership to the session user", async () => {
    mocks.member.mockResolvedValue(null);
    expect((await createLink("other-team", {}, form())).error).toBeTruthy();
    expect(mocks.member.mock.calls[0][0].where).toEqual({
      userId: "user_test",
      project: { slug: "other-team", disabledAt: null },
    });
    expect(mocks.linkCreate).not.toHaveBeenCalled();
  });
  it("allows only owners to change settings", async () => {
    mocks.member.mockResolvedValue({ role: "member", project: workspace });
    const data = new FormData();
    data.set("name", "New team");
    expect((await saveWorkspace("team", {}, data)).error).toBeTruthy();
    expect(mocks.project).not.toHaveBeenCalled();
  });
  it("requires a domain from the same workspace", async () => {
    mocks.domainFind.mockResolvedValue(null);
    expect((await createLink("team", {}, form())).error).toContain(
      "verified, active",
    );
    expect(mocks.domainFind.mock.calls[0][0].where).toEqual({
      id: "dom_test",
      projectId: "ws_test",
    });
    expect(mocks.linkCreate).not.toHaveBeenCalled();
  });
  it.each([
    { verified: false },
    { suspendedAt: new Date() },
    { type: "TRANSPARENT_TRACKING" },
  ])("does not create links on unavailable domains: %j", async (override) => {
    mocks.domainFind.mockResolvedValue({
      id: "dom_test",
      verified: true,
      suspendedAt: null,
      type: "STANDARD_LINK",
      ...override,
    });
    expect((await createLink("team", {}, form())).error).toBeTruthy();
    expect(mocks.linkCreate).not.toHaveBeenCalled();
  });
  it("enforces the free plan limit inside the transaction", async () => {
    mocks.project.mockResolvedValue({ ...workspace, totalLinks: 26 });
    expect((await createLink("team", {}, form())).error).toContain("limit");
    expect(mocks.linkCreate).not.toHaveBeenCalled();
  });
  it("allows the 25th free link", async () => {
    mocks.project.mockResolvedValue({ ...workspace, totalLinks: 25 });
    expect((await createLink("team", {}, form())).error).toBeUndefined();
    expect(mocks.linkCreate).toHaveBeenCalledOnce();
  });
  it("persists only standard functionality with session ownership", async () => {
    expect((await createLink("team", {}, form())).message).toContain(
      "Standard link created",
    );
    const { data } = mocks.linkCreate.mock.calls[0][0];
    expect(data).toMatchObject({
      projectId: "ws_test",
      userId: "user_test",
      trackConversion: false,
      shortLink: "http://localhost:8888/r/team/hello",
    });
  });
  it("cannot delete another workspace's link or decrement its count", async () => {
    mocks.linkDelete.mockResolvedValue({ count: 0 });
    expect((await deleteLink("team", "foreign-link", {})).error).toContain(
      "not found",
    );
    expect(mocks.linkDelete.mock.calls[0][0].where).toEqual({
      id: "foreign-link",
      projectId: "ws_test",
    });
    expect(
      mocks.project.mock.calls.some(([arg]) => arg.data.totalLinks?.decrement),
    ).toBe(false);
  });
  it("does not exceed the per-account workspace ceiling", async () => {
    mocks.count.mockResolvedValue(10);
    const data = new FormData();
    data.set("name", "New workspace");
    data.set("slug", "new-workspace");
    expect((await createWorkspace({}, data)).error).toContain("ten workspaces");
    expect(mocks.projectCreate).not.toHaveBeenCalled();
  });
  it("surfaces rate-limit rejection explicitly", async () => {
    mocks.allow.mockResolvedValue(false);
    expect((await createLink("team", {}, form())).error).toContain(
      "Too many requests",
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
