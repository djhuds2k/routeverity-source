import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { z } from "zod";
import { destinationSchema } from "./validation";

export const trafficSources = [
  { value: "GOOGLE_ADS", label: "Google Ads" },
  { value: "MICROSOFT_ADS", label: "Microsoft Ads" },
  { value: "META_ADS", label: "Meta Ads" },
  { value: "TIKTOK_ADS", label: "TikTok Ads" },
  { value: "OTHER", label: "Other" },
] as const;
export const campaignStatuses = [
  "DRAFT",
  "ACTIVE",
  "SUSPENDED",
  "ARCHIVED",
] as const;
export const parameterKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;
export const currencies = Intl.supportedValuesOf("currency");

export function normalizeDestinationHostname(value: string): string | null {
  const raw = value.trim().toLowerCase().replace(/\.$/, "");
  if (!raw || /[:/\\@?#%*\s]/.test(raw)) return null;
  const ascii = domainToASCII(raw);
  if (
    !ascii ||
    isIP(ascii) ||
    !ascii.includes(".") ||
    ascii.length > 253 ||
    ascii
      .split(".")
      .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    return null;
  if (
    [
      "localhost",
      "local",
      "internal",
      "test",
      "invalid",
      "example",
      "onion",
    ].some((suffix) => ascii === suffix || ascii.endsWith(`.${suffix}`))
  )
    return null;
  return ascii;
}

export const policySchema = z
  .array(
    z.object({
      hostname: z.string().transform((value, ctx) => {
        const normalized = normalizeDestinationHostname(value);
        if (!normalized) {
          ctx.addIssue({
            code: "custom",
            message:
              "Enter a public destination hostname, without a URL, IP address, port or wildcard.",
          });
          return z.NEVER;
        }
        return normalized;
      }),
      includeSubdomains: z.boolean(),
    }),
  )
  .max(50)
  .refine(
    (rules) =>
      new Set(rules.map((rule) => rule.hostname)).size === rules.length,
    "Each destination hostname must appear only once.",
  );

export const trackingParametersSchema = z
  .object({
    utm_source: z.string().trim().min(1).max(500).optional(),
    utm_medium: z.string().trim().min(1).max(500).optional(),
    utm_campaign: z.string().trim().min(1).max(500).optional(),
    utm_term: z.string().trim().min(1).max(500).optional(),
    utm_content: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const campaignSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    advertiser: z.string().trim().min(2).max(120),
    trafficSource: z.enum([
      "GOOGLE_ADS",
      "MICROSOFT_ADS",
      "META_ADS",
      "TIKTOK_ADS",
      "OTHER",
    ]),
    externalCampaignId: z.string().trim().max(200),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .refine(
        (value) => currencies.includes(value),
        "Choose a supported ISO currency.",
      ),
    status: z.enum(campaignStatuses),
    trackingDomainId: z.string().max(100),
    notes: z.string().trim().max(5000),
    destinationDomains: policySchema,
    trackingParameters: trackingParametersSchema,
  })
  .refine(
    (value) => value.status !== "ACTIVE" || value.destinationDomains.length > 0,
    {
      message:
        "An active campaign needs at least one approved destination hostname.",
      path: ["destinationDomains"],
    },
  );

export type DestinationRule = z.infer<typeof policySchema>[number];

export function isCampaignDestinationAllowed(
  destination: string,
  rules: readonly DestinationRule[],
) {
  if (
    [...destination].some(
      (character) =>
        character === "\\" ||
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) === 127,
    )
  )
    return false;
  const parsed = destinationSchema.safeParse(destination);
  if (!parsed.success) return false;
  const hostname = normalizeDestinationHostname(new URL(parsed.data).hostname);
  if (!hostname) return false;
  return rules.some((rule) => {
    const approved = normalizeDestinationHostname(rule.hostname);
    return (
      approved !== null &&
      (hostname === approved ||
        (rule.includeSubdomains && hostname.endsWith(`.${approved}`)))
    );
  });
}

export function campaignReadiness(campaign: {
  status: string;
  destinationDomains: readonly DestinationRule[];
  trackingDomain: {
    verified: boolean;
    suspendedAt: Date | null;
    archived: boolean;
    type: string;
  } | null;
}) {
  if (campaign.status !== "ACTIVE")
    return `Campaign is ${campaign.status.toLowerCase()}.`;
  if (!campaign.destinationDomains.length)
    return "No approved destination hostnames.";
  const domain = campaign.trackingDomain;
  if (!domain || domain.type !== "TRANSPARENT_TRACKING")
    return "Select a transparent tracking domain.";
  if (!domain.verified) return "Tracking domain ownership is not verified.";
  if (domain.suspendedAt || domain.archived)
    return "Tracking domain is unavailable.";
  return null;
}
