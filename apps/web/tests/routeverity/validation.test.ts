import { brand } from "@/lib/routeverity/brand";
import {
  canWrite,
  destinationSchema,
  domainSchema,
  isLocalOrigin,
  linkSchema,
  workspaceSchema,
} from "@/lib/routeverity/validation";
import { describe, expect, it } from "vitest";

describe("RouteVerity input boundaries", () => {
  it("normalizes workspace identifiers without permitting paths", () => {
    expect(workspaceSchema.parse({ name: " Team ", slug: "TEAM-ONE" })).toEqual(
      { name: "Team", slug: "team-one" },
    );
    for (const slug of ["../admin", "team--one", "ab", "-team"])
      expect(workspaceSchema.safeParse({ name: "Team", slug }).success).toBe(
        false,
      );
  });
  it("rejects non-HTTP destinations and embedded credentials", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,test",
      "ftp://example.com",
      "https://user:secret@example.com",
    ])
      expect(destinationSchema.safeParse(url).success).toBe(false);
    expect(
      destinationSchema.parse("https://example.com/landing?campaign=summer"),
    ).toContain("campaign=summer");
  });
  it("reserves local domains and rejects arbitrary development types", () => {
    for (const slug of [
      "http://example.com",
      "example.com/path",
      "foo.localhost",
      "foo.local",
    ])
      expect(
        domainSchema.safeParse({ slug, type: "STANDARD_LINK" }).success,
      ).toBe(false);
    expect(
      domainSchema.safeParse({ slug: "links.example.com", type: "DEVELOPMENT" })
        .success,
    ).toBe(false);
    expect(
      domainSchema.parse({ slug: " Links.Example.com ", type: "STANDARD_LINK" })
        .slug,
    ).toBe("links.example.com");
  });
  it("validates link keys", () => {
    for (const key of ["a/b", "..", "", "hello world", "x".repeat(81)])
      expect(
        linkSchema.safeParse({
          domainId: "dom_test",
          key,
          url: "https://example.com",
        }).success,
      ).toBe(false);
  });
  it("allows writes only to ordinary editor roles", () => {
    expect(canWrite("owner")).toBe(true);
    expect(canWrite("member")).toBe(true);
    for (const role of ["viewer", "billing", "admin", "unknown"])
      expect(canWrite(role)).toBe(false);
  });
  it("identifies only loopback app origins as development", () => {
    expect(isLocalOrigin("http://localhost:8888")).toBe(true);
    expect(isLocalOrigin("https://routeverity.com")).toBe(false);
    expect(isLocalOrigin("http://localhost.attacker.example")).toBe(false);
  });
  it("does not enable deferred features or certification claims", () => {
    expect(brand.certificationStatus).toBe("NOT_SUBMITTED");
    expect(
      brand.navigation.filter((item) => item.enabled).map((item) => item.label),
    ).toEqual([
      "Overview",
      "Campaigns",
      "Links",
      "Conversions",
      "Analytics",
      "Domains",
      "Settings",
    ]);
  });
});
