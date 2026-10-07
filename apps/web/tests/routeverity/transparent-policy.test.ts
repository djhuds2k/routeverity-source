import {
  assertRedirectIntegrity,
  fingerprint,
  hasRedirectIntegrity,
  issueTrackingToken,
  parseTrackingRequest,
  tokenMatches,
  TrackingError,
  trackingHost,
  validateTransparentDestination,
} from "@/lib/routeverity/transparent-policy";
import { describe, expect, it } from "vitest";

const token = issueTrackingToken();
const campaignId = "cmp_policy_test";
const query = (destination: string) =>
  new URLSearchParams({
    url: destination,
    rv_campaign: campaignId,
    rv_token: token.token,
  }).toString();

describe("transparent next-hop schema", () => {
  it("decodes exactly once while preserving ordered queries, escapes, plus signs and fragments", () => {
    const destination =
      "https://example.com/a%2fb?b=2&a=1&a=2&value=a+b&escaped=%2520#section%20one";
    expect(
      parseTrackingRequest(
        `https://track.example.com/click?${query(destination)}`,
      ).destination,
    ).toBe(destination);
    expect(validateTransparentDestination(destination).destination).toBe(
      destination,
    );
  });
  it.each([
    "",
    "url=https%3A%2F%2Fexample.com",
    `${query("https://example.com")}&url=https%3A%2F%2Fevil.org`,
    `${query("https://example.com")}&%75rl=https%3A%2F%2Fevil.org`,
    `${query("https://example.com")}&rv_token=${token.token}`,
    `${query("https://example.com")}&rv_campaign=${campaignId}`,
    `${query("https://example.com")}&rv_click=forged`,
    `${query("https://example.com")}&gclid=%7Bgclid%7D`,
    `${query("https://example.com")}&gbraid=%0d%0a`,
    `${query("https://example.com")}&wbraid=a%2520b`,
    `${query("https://example.com")}&campaignid=unsupported`,
    "url=%GG&rv_campaign=cmp_policy_test&rv_token=bad",
    "url=%C3%28&rv_campaign=cmp_policy_test&rv_token=bad",
    `url=https%253A%252F%252Fexample.com&rv_campaign=${campaignId}&rv_token=${token.token}`,
    query("https://example.com").replace(campaignId, "123"),
    query("https://example.com").replace(token.token, "rvt_bad"),
  ])(
    "rejects ambiguous, unsupported or invalid tracking input %s",
    (search) => {
      expect(() => {
        const parsed = parseTrackingRequest(
          `https://track.example.com/click?${search}`,
        );
        validateTransparentDestination(parsed.destination);
      }).toThrow(TrackingError);
    },
  );
  it("rejects oversized queries", () => {
    expect(() =>
      parseTrackingRequest(
        `https://track.example.com/click?${query("https://example.com")}&x=${"a".repeat(16384)}`,
      ),
    ).toThrow();
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "ftp://example.com",
    "blob:https://example.com/test",
    "//example.com",
    "http://example.com",
    "https%3A%2F%2Fexample.com",
    " https://example.com",
    "https://example.com/ trailing",
    "https://example.com/\r\nLocation:https://evil.org",
    "https://example.com/%0d%0aX-Injected:test",
    "https://example.com/?value=%00",
    "https://example.com/\\evil",
    "https://user:secret@example.com",
    "https://@example.com",
    "https://example%2ecom",
    "https:///example.com",
    "https://127.0.0.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://[::1]",
    "https://localhost",
    "https://example.local",
    "https://example.com:8443",
    "https://example.com/%GG",
    "https://example.com/?value=\u007f",
  ])("rejects an unsafe or non-deterministic destination %s", (destination) => {
    expect(() => validateTransparentDestination(destination)).toThrow(
      TrackingError,
    );
  });
  it.each([
    "https://example.com",
    "https://example.com:443/path",
    "https://xn--bcher-kva.de/path%20one?q=a%2Bb#fragment",
  ])("allows an explicit HTTPS next hop %s", (destination) => {
    expect(validateTransparentDestination(destination).destination).toBe(
      destination,
    );
  });
  it("encodes Unicode and IDNA deterministically without changing the logical next hop", () => {
    const provided = "https://bücher.de/été?q=été#über";
    expect(validateTransparentDestination(provided)).toEqual({
      hostname: "xn--bcher-kva.de",
      destination:
        "https://xn--bcher-kva.de/%C3%A9t%C3%A9?q=%C3%A9t%C3%A9#%C3%BCber",
    });
  });
  it("rejects oversized next hops and invalid Unicode", () => {
    expect(() =>
      validateTransparentDestination(`https://example.com/${"a".repeat(8000)}`),
    ).toThrow();
    expect(() =>
      validateTransparentDestination("https://example.com/\ud800"),
    ).toThrow();
  });
  it("supports locally routed, database-verified test tracking hosts without allowing local destinations", () => {
    expect(trackingHost("TRACKING.example.test:8888")).toBe(
      "tracking.example.test",
    );
    expect(() => trackingHost("localhost:8888")).toThrow();
    expect(() => trackingHost("track.example.com,evil.org")).toThrow();
    expect(() => trackingHost("evil.org/path")).toThrow();
  });
  it("issues URL-safe random credentials and stores only verifiable hashes", () => {
    expect(token.token).toMatch(/^rvt_[A-Za-z0-9_-]{43}$/);
    expect(tokenMatches(token.token, token.hash)).toBe(true);
    expect(tokenMatches(issueTrackingToken().token, token.hash)).toBe(false);
    expect(tokenMatches(token.token, null)).toBe(false);
    expect(tokenMatches(token.token, "invalid")).toBe(false);
    expect(
      new Set(Array.from({ length: 100 }, () => issueTrackingToken().token))
        .size,
    ).toBe(100);
  });
  it("treats any actual Location mismatch as a critical fail-closed condition", () => {
    expect(() =>
      assertRedirectIntegrity(
        "https://example.com/?a=1&a=2",
        "https://example.com/?a=2&a=1",
      ),
    ).toThrow("REDIRECT_INTEGRITY_MISMATCH");
    expect(() =>
      assertRedirectIntegrity("https://example.com", null),
    ).toThrow();
    const hash = fingerprint("https://example.com");
    const record = {
      providedNextHopHash: hash,
      validatedNextHopHash: hash,
      actualRedirectTargetHash: hash,
      validationResult: "ALLOWED",
      redirectStatus: 302,
    };
    expect(hasRedirectIntegrity(record)).toBe(true);
    expect(
      hasRedirectIntegrity({
        ...record,
        actualRedirectTargetHash: fingerprint("https://evil.org"),
      }),
    ).toBe(false);
    expect(hasRedirectIntegrity({ ...record, redirectStatus: 301 })).toBe(
      false,
    );
  });
});
