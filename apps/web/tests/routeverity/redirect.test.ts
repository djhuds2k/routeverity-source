import { resolveStandardLink } from "@/lib/routeverity/redirect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { link: { findUnique } } }));

const active = {
  url: "https://example.com",
  archived: false,
  disabledAt: null,
  expiresAt: null,
  project: { disabledAt: null },
  shortDomain: { verified: true, suspendedAt: null, type: "STANDARD_LINK" },
};

describe("standard redirect availability", () => {
  beforeEach(() => findUnique.mockResolvedValue(active));
  it("queries the exact domain/key pair and returns the persisted destination", async () => {
    expect(await resolveStandardLink("links.example.com", "hello", false)).toBe(
      "https://example.com",
    );
    expect(findUnique.mock.calls[0][0].where).toEqual({
      domain_key: { domain: "links.example.com", key: "hello" },
    });
  });
  it.each([
    { archived: true },
    { disabledAt: new Date() },
    { expiresAt: new Date(0) },
    { project: null },
    { project: { disabledAt: new Date() } },
    { shortDomain: { ...active.shortDomain, verified: false } },
    { shortDomain: { ...active.shortDomain, suspendedAt: new Date() } },
    { shortDomain: { ...active.shortDomain, type: "TRANSPARENT_TRACKING" } },
    { shortDomain: { ...active.shortDomain, type: "DEVELOPMENT" } },
    { url: "javascript:alert(1)" },
  ])("does not redirect unavailable or invalid links: %j", async (override) => {
    findUnique.mockResolvedValue({ ...active, ...override });
    expect(
      await resolveStandardLink("links.example.com", "hello", false),
    ).toBeNull();
  });
  it("separates development domains from production standard links", async () => {
    findUnique.mockResolvedValue({
      ...active,
      shortDomain: { ...active.shortDomain, type: "DEVELOPMENT" },
    });
    expect(await resolveStandardLink("test.localhost", "hello", true)).toBe(
      active.url,
    );
    expect(
      await resolveStandardLink("test.localhost", "hello", false),
    ).toBeNull();
  });
  it("returns no destination for an absent link", async () => {
    findUnique.mockResolvedValue(null);
    expect(
      await resolveStandardLink("links.example.com", "missing", false),
    ).toBeNull();
  });
});
