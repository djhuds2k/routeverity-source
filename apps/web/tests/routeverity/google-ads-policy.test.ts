import {
  buildGoogleAdsTemplate,
  expandGoogleAdsTemplate,
  googleAdsPreviewValues,
} from "@/lib/routeverity/google-ads-policy";
import {
  fingerprint,
  issueTrackingToken,
  parseTrackingRequest,
  validateTransparentDestination,
} from "@/lib/routeverity/transparent-policy";
import { describe, expect, it } from "vitest";

const credential = issueTrackingToken();
const campaignId = "cmp_google_policy";
const destination =
  "https://example.com/a%2fb?x=1&x=2&q=a+b&percent=%2520#receipt%20one";
const path = (extra = "") =>
  `https://track.example.com/click?${new URLSearchParams({ url: destination, rv_campaign: campaignId, rv_token: credential.token })}${extra}`;

describe("Google Ads transparent schema and local template model", () => {
  it.each(["lpurl", "escapedlpurl"] as const)(
    "keeps literal %s and models one encoded expansion without changing the next hop",
    (insertion) => {
      const template = buildGoogleAdsTemplate({
        domain: "track.example.com",
        campaignId,
        token: credential.token,
        insertion,
      });
      expect(template).toContain(`url={${insertion}}&`);
      expect(template).not.toContain("%7B");
      const expanded = expandGoogleAdsTemplate(template, destination);
      const parsed = parseTrackingRequest(expanded);
      expect(parsed.destination).toBe(destination);
      expect(
        validateTransparentDestination(parsed.destination).destination,
      ).toBe(destination);
      expect(parsed.googleAds).toMatchObject({
        campaignid: googleAdsPreviewValues.campaignid,
        gclidHash: fingerprint(googleAdsPreviewValues.gclid),
      });
      expect(JSON.stringify(parsed.googleAds)).not.toContain(
        googleAdsPreviewValues.gclid,
      );
    },
  );
  it("fingerprints all three identifiers without requiring or selecting a preferred one", () => {
    const parsed = parseTrackingRequest(
      path("&gclid=valid_gclid&gbraid=valid_gbraid&wbraid=valid_wbraid"),
    );
    expect(parsed.googleAds).toEqual({
      gclidHash: fingerprint("valid_gclid"),
      gbraidHash: fingerprint("valid_gbraid"),
      wbraidHash: fingerprint("valid_wbraid"),
    });
    expect(parsed.destination).toBe(destination);
  });
  it("ignores explicitly empty optional values but rejects duplicate empty keys", () => {
    expect(
      parseTrackingRequest(
        path("&gclid=&creative=&matchtype=&device=&network="),
      ).googleAds,
    ).toEqual({});
    expect(() => parseTrackingRequest(path("&gclid=&gclid="))).toThrow();
  });
  it.each([
    "&gclid=a&gclid=b",
    "&gclid=a&%67clid=b",
    "&campaignid=1&campaignid=2",
    "&gbraid=a%20b",
    "&wbraid=a%2Bb",
    "&gclid=%0d%0a",
    "&gclid=%252F",
    "&gclid={gclid}",
    "&campaignid={campaignid}",
    "&campaignid=-1",
    "&campaignid=1.2",
    "&campaignid=" + "1".repeat(21),
    "&device=mobile",
    "&network=" + "x".repeat(13),
    "&matchtype=exact",
    "&keyword=private",
    "&placement=private",
    "&loc_physical_ms=123",
    "&gclid=" + "x".repeat(513),
    "&gclid=%C3%28",
  ])("rejects unsupported, ambiguous or invalid source fields %s", (extra) => {
    expect(() => parseTrackingRequest(path(extra))).toThrow();
  });
  it.each(["m", "t", "c"])("accepts documented device %s", (device) => {
    expect(
      parseTrackingRequest(path(`&device=${device}`)).googleAds.device,
    ).toBe(device);
  });
  it.each(["g", "s", "d", "ytv", "vp", "gtv", "x", "e"])(
    "accepts documented network %s",
    (network) => {
      expect(
        parseTrackingRequest(path(`&network=${network}`)).googleAds.network,
      ).toBe(network);
    },
  );
  it("enforces the exact advertising identifier size boundary", () => {
    expect(
      parseTrackingRequest(path("&gclid=" + "x".repeat(512))).googleAds
        .gclidHash,
    ).toHaveLength(64);
  });
  it("preserves identifier-looking fields inside the merchant destination without interpreting or injecting them", () => {
    const target = `${destination.slice(0, destination.indexOf("#"))}&gclid=merchant-owned#fragment`;
    const request = `https://track.example.com/click?${new URLSearchParams({ url: target, rv_campaign: campaignId, rv_token: credential.token, gclid: "tracker-value" })}`;
    const parsed = parseTrackingRequest(request);
    expect(parsed.destination).toBe(target);
    expect(parsed.googleAds.gclidHash).toBe(fingerprint("tracker-value"));
  });
});
