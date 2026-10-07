import { generateGoogleAdsSetup } from "@/lib/routeverity/google-ads-actions";
import {
  issueTrackingToken,
  parseTrackingRequest,
} from "@/lib/routeverity/transparent-policy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  find: vi.fn(),
  user: vi.fn(),
  allow: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectUsers: { findFirst: mocks.member },
    routeVerityCampaign: { findFirst: mocks.find },
  },
}));
vi.mock("@/lib/routeverity/auth", () => ({ requireUser: mocks.user }));
vi.mock("@/lib/routeverity/rate-limit", () => ({ allowRequest: mocks.allow }));
const key = issueTrackingToken();
const campaign = {
  id: "cmp_google_actions",
  projectId: "ws_test",
  status: "ACTIVE",
  trackingTokenHash: key.hash,
  destinationDomains: [{ hostname: "example.com", includeSubdomains: false }],
  trackingDomain: {
    projectId: "ws_test",
    slug: "track.example.com",
    type: "TRANSPARENT_TRACKING",
    verified: true,
    suspendedAt: null,
    archived: false,
  },
};
function form(override: Partial<Record<string, string>> = {}) {
  const data = new FormData();
  for (const [name, value] of Object.entries({
    token: key.token,
    insertion: "escapedlpurl",
    destination: "https://example.com/?x=1&x=2#receipt",
    ...override,
  }))
    if (value !== undefined) data.set(name, value);
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "user_test" });
  mocks.member.mockResolvedValue({ role: "owner", project: { id: "ws_test" } });
  mocks.allow.mockResolvedValue(true);
  mocks.find.mockResolvedValue(structuredClone(campaign));
});
describe("Google setup saved-policy boundaries", () => {
  it("returns a campaign-bound template, explicit local preview and unchanged validated next hop", async () => {
    const result = await generateGoogleAdsSetup(
      "team",
      campaign.id,
      {},
      form(),
    );
    expect(result.googleTemplate).toContain("url={escapedlpurl}");
    expect(parseTrackingRequest(result.googlePreview!).destination).toBe(
      result.googleValidatedTarget,
    );
    expect(mocks.find.mock.calls[0][0].where).toEqual({
      id: campaign.id,
      projectId: "ws_test",
    });
  });
  it.each(["viewer", "billing"])(
    "denies %s template generation",
    async (role) => {
      mocks.member.mockResolvedValue({ role, project: { id: "ws_test" } });
      expect(
        (await generateGoogleAdsSetup("team", campaign.id, {}, form())).error,
      ).toContain("permission");
      expect(mocks.find).not.toHaveBeenCalled();
    },
  );
  it("rejects non-members and foreign campaigns", async () => {
    mocks.member.mockResolvedValueOnce(null);
    expect(
      (await generateGoogleAdsSetup("foreign", campaign.id, {}, form())).error,
    ).toContain("permission");
    mocks.find.mockResolvedValueOnce(null);
    expect(
      (await generateGoogleAdsSetup("team", "foreign-campaign", {}, form()))
        .error,
    ).toContain("not found");
  });
  it.each([
    { token: issueTrackingToken().token },
    { token: "" },
    { insertion: "lpurl+2" },
    { destination: "https://evil.org/" },
    { destination: "http://example.com/" },
    { destination: "https://example.com/%0d%0a" },
  ])("rejects invalid credential, macro or final URL %j", async (override) => {
    const result = await generateGoogleAdsSetup(
      "team",
      campaign.id,
      {},
      form(override),
    );
    expect(result.error).toBeTruthy();
    expect(result.googleTemplate).toBeUndefined();
  });
  it("rejects suspended, unverified and foreign tracking domains", async () => {
    for (const trackingDomain of [
      { ...campaign.trackingDomain, suspendedAt: new Date() },
      { ...campaign.trackingDomain, verified: false },
      { ...campaign.trackingDomain, projectId: "foreign" },
    ]) {
      mocks.find.mockResolvedValue({ ...campaign, trackingDomain });
      expect(
        (await generateGoogleAdsSetup("team", campaign.id, {}, form())).error,
      ).toBeTruthy();
    }
  });
});
