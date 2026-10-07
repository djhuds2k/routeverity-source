import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeDestinationHostname } from "./campaign-policy";
import {
  GoogleAdsInputError,
  googleAdsParameterKeys,
  googleIdentifierKeys,
  parseGoogleAdsParameters,
} from "./google-ads-policy";
import { domainSchema } from "./validation";

export const redirectPolicyVersion = "transparent-v2";
export const redirectAppVersion = "routeverity-milestone-6";
export const trackingCampaignLimit = 6000;
export const trackingWindowSeconds = 60;

export class TrackingError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

export function fingerprint(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function issueTrackingToken() {
  const token = `rvt_${randomBytes(32).toString("base64url")}`;
  return { token, hash: fingerprint(token) };
}

export function tokenMatches(token: string, hash: string | null) {
  return (
    hash !== null &&
    /^[a-f0-9]{64}$/.test(hash) &&
    timingSafeEqual(
      Buffer.from(fingerprint(token), "hex"),
      Buffer.from(hash, "hex"),
    )
  );
}

export function parseTrackingRequest(requestUrl: string) {
  const search = new URL(requestUrl).search.slice(1);
  if (!search || search.length > 16384)
    throw new TrackingError(400, "INVALID_QUERY");
  const parameters = new Map<string, string>();
  for (const part of search.split("&")) {
    const separator = part.indexOf("=");
    if (separator < 1) throw new TrackingError(400, "INVALID_QUERY");
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(part.slice(0, separator).replace(/\+/g, " "));
      value = decodeURIComponent(part.slice(separator + 1).replace(/\+/g, " "));
    } catch {
      throw new TrackingError(400, "INVALID_ENCODING");
    }
    if (
      !["url", "rv_campaign", "rv_token", ...googleAdsParameterKeys].includes(
        key,
      ) ||
      parameters.has(key)
    )
      throw new TrackingError(400, "AMBIGUOUS_OR_UNSUPPORTED_PARAMETER");
    parameters.set(key, value);
  }
  const destination = parameters.get("url");
  const campaignId = parameters.get("rv_campaign");
  const token = parameters.get("rv_token");
  if (!destination || !campaignId || !token)
    throw new TrackingError(400, "MISSING_TRACKING_PARAMETER");
  if (
    !/^cmp_[A-Za-z0-9_-]{8,64}$/.test(campaignId) ||
    !/^rvt_[A-Za-z0-9_-]{43}$/.test(token)
  )
    throw new TrackingError(400, "INVALID_TRACKING_CREDENTIAL");
  try {
    const values = parseGoogleAdsParameters(parameters);
    const googleAds = Object.fromEntries(
      Object.entries(values).map(([key, value]) =>
        googleIdentifierKeys.some((identifier) => identifier === key)
          ? [`${key}Hash`, fingerprint(value)]
          : [key, value],
      ),
    );
    return { destination, campaignId, token, googleAds };
  } catch (error) {
    if (!(error instanceof GoogleAdsInputError)) throw error;
    throw new TrackingError(400, error.message);
  }
}

export function validateTransparentDestination(destination: string) {
  if (
    destination.length > 8000 ||
    !/^https:\/\//i.test(destination) ||
    [...destination].some((character) => {
      const point = character.codePointAt(0);
      return (
        point === undefined ||
        point < 33 ||
        point === 127 ||
        (point >= 0xd800 && point <= 0xdfff)
      );
    }) ||
    destination.includes("\\") ||
    /%(?![a-f0-9]{2})|%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(destination)
  )
    throw new TrackingError(400, "INVALID_DESTINATION");
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    throw new TrackingError(400, "INVALID_DESTINATION");
  }
  const hostname = normalizeDestinationHostname(url.hostname);
  const authority = destination.match(/^https:\/\/([^/?#]+)/i)?.[1];
  if (
    !authority ||
    /[@%]/.test(authority) ||
    !hostname ||
    url.username ||
    url.password ||
    url.port
  )
    throw new TrackingError(400, "INVALID_DESTINATION");
  return {
    destination: [...destination].some(
      (character) => character.charCodeAt(0) > 127,
    )
      ? url.href
      : destination,
    hostname,
  };
}

export function trackingHost(header: string | null) {
  if (!header || !/^[a-z0-9.-]+(?::(?:80|443|8888))?$/i.test(header))
    throw new TrackingError(404, "TRACKING_DOMAIN_UNAVAILABLE");
  const hostname = header.split(":")[0].toLowerCase();
  if (!domainSchema.shape.slug.safeParse(hostname).success)
    throw new TrackingError(404, "TRACKING_DOMAIN_UNAVAILABLE");
  return hostname;
}

export function assertRedirectIntegrity(
  validated: string,
  actual: string | null,
): asserts actual is string {
  if (validated !== actual)
    throw new TrackingError(503, "REDIRECT_INTEGRITY_MISMATCH");
}

export function hasRedirectIntegrity(record: {
  providedNextHopHash: string;
  validatedNextHopHash: string;
  actualRedirectTargetHash: string;
  validationResult: string;
  redirectStatus: number;
}) {
  return (
    /^[a-f0-9]{64}$/.test(record.providedNextHopHash) &&
    /^[a-f0-9]{64}$/.test(record.validatedNextHopHash) &&
    record.validatedNextHopHash === record.actualRedirectTargetHash &&
    record.validationResult === "ALLOWED" &&
    record.redirectStatus === 302
  );
}
