export const googleAdsMacros = {
  campaignid: "{campaignid}",
  adgroupid: "{adgroupid}",
  creative: "{creative}",
  matchtype: "{matchtype}",
  device: "{device}",
  network: "{network}",
  gclid: "{gclid}",
} as const;
export const googleIdentifierKeys = ["gclid", "gbraid", "wbraid"] as const;
export const googleAdsParameterKeys = [
  ...Object.keys(googleAdsMacros),
  "gbraid",
  "wbraid",
] as const;

export class GoogleAdsInputError extends Error {}

export function parseGoogleAdsParameters(parameters: Map<string, string>) {
  const result: Record<string, string> = {};
  for (const key of googleAdsParameterKeys) {
    const value = parameters.get(key);
    if (value === undefined || value === "") continue;
    const valid =
      key === "campaignid" || key === "adgroupid" || key === "creative"
        ? /^[1-9][0-9]{0,19}$/.test(value)
        : key === "device"
          ? ["m", "t", "c"].includes(value)
          : key === "matchtype"
            ? ["e", "p", "b"].includes(value)
            : key === "network"
              ? /^[a-z][a-z0-9]{0,11}$/.test(value)
              : /^[A-Za-z0-9_-]{1,512}$/.test(value);
    if (!valid) throw new GoogleAdsInputError("INVALID_GOOGLE_PARAMETER");
    result[key] = value;
  }
  return result;
}

export function buildGoogleAdsTemplate({
  domain,
  campaignId,
  token,
  insertion,
}: {
  domain: string;
  campaignId: string;
  token: string;
  insertion: "lpurl" | "escapedlpurl";
}) {
  if (
    !/^[a-z0-9.-]+$/.test(domain) ||
    !/^cmp_[A-Za-z0-9_-]{8,64}$/.test(campaignId) ||
    !/^rvt_[A-Za-z0-9_-]{43}$/.test(token)
  )
    throw new GoogleAdsInputError("INVALID_TEMPLATE_CONFIGURATION");
  const query = new URLSearchParams({
    url: `{${insertion}}`,
    rv_campaign: campaignId,
    rv_token: token,
    ...googleAdsMacros,
  });
  return `https://${domain}/click?${query}`.replace(/%7B([a-z]+)%7D/g, "{$1}");
}

export const googleAdsPreviewValues = {
  campaignid: "123456789",
  adgroupid: "234567890",
  creative: "345678901",
  matchtype: "e",
  device: "c",
  network: "g",
  gclid: "local_preview_not_a_google_click",
} as const;

export function expandGoogleAdsTemplate(template: string, destination: string) {
  // This models one encoded substitution, not execution by Google's live systems.
  return template.replace(/\{([a-z]+)\}/g, (_match, key: string) => {
    if (key === "lpurl" || key === "escapedlpurl")
      return encodeURIComponent(destination);
    const value = Object.entries(googleAdsPreviewValues).find(
      ([name]) => name === key,
    )?.[1];
    if (value === undefined)
      throw new GoogleAdsInputError("UNSUPPORTED_TEMPLATE_MACRO");
    return encodeURIComponent(value);
  });
}
