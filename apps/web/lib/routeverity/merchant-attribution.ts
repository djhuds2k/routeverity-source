import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  conversionAttributionWindowMs,
  ConversionError,
} from "./conversion-policy";
import {
  GoogleAdsInputError,
  parseGoogleAdsParameters,
} from "./google-ads-policy";
import { fingerprint, hasRedirectIntegrity } from "./transparent-policy";

const consentSchema = z.enum(["granted", "denied", "unknown"]);
const contextSchema = z
  .object({
    projectId: z.string().min(1).max(100),
    campaignId: z.string().regex(/^cmp_[A-Za-z0-9_-]{8,64}$/),
    gclidHash: z.string().regex(/^[a-f0-9]{64}$/),
    occurredAt: z.date(),
  })
  .strict();

export function captureMerchantGclid(search: string, consent: unknown) {
  const parsedConsent = consentSchema.safeParse(consent);
  if (!parsedConsent.success)
    throw new ConversionError(400, "INVALID_MEASUREMENT_CONSENT");
  if (parsedConsent.data !== "granted")
    return { status: "CONSENT_NOT_GRANTED" } as const;
  if (search.length > 16384)
    throw new ConversionError(400, "INVALID_MERCHANT_QUERY");
  const query = new URLSearchParams(search);
  const values = query.getAll("gclid");
  if (values.length > 1) return { status: "AMBIGUOUS_IDENTIFIER" } as const;
  if (!values.length || !values[0])
    return { status: "MISSING_IDENTIFIER" } as const;
  try {
    parseGoogleAdsParameters(new Map([["gclid", values[0]]]));
  } catch (error) {
    if (!(error instanceof GoogleAdsInputError)) throw error;
    throw new ConversionError(400, "INVALID_MERCHANT_IDENTIFIER");
  }
  return { status: "READY", gclidHash: fingerprint(values[0]) } as const;
}

// Trusted server callers must supply an already-authorized workspace, not browser input.
export async function resolveMerchantCandidate(
  input: z.input<typeof contextSchema>,
  now = new Date(),
) {
  const context = validateMerchantContext(input, now);
  return prisma.$transaction(
    (tx) => resolveMerchantCandidateInTransaction(tx, context, now),
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 1000,
      timeout: 3000,
    },
  );
}

function validateMerchantContext(
  input: z.input<typeof contextSchema>,
  now: Date,
) {
  const parsed = contextSchema.safeParse(input);
  if (
    !parsed.success ||
    Number.isNaN(now.getTime()) ||
    parsed.data.occurredAt > now
  )
    throw new ConversionError(400, "INVALID_MERCHANT_CONTEXT");
  return parsed.data;
}

export async function resolveMerchantCandidateInTransaction(
  tx: Prisma.TransactionClient,
  input: z.input<typeof contextSchema>,
  now = new Date(),
) {
  const { projectId, campaignId, gclidHash, occurredAt } =
    validateMerchantContext(input, now);
  const workspace = await tx.project.findFirst({
    where: { id: projectId, disabledAt: null },
    select: { id: true },
  });
  if (!workspace) throw new ConversionError(403, "WORKSPACE_UNAVAILABLE");
  const candidates = await tx.routeVerityRedirectAudit.findMany({
    where: {
      projectId,
      campaignId,
      validationResult: "ALLOWED",
      redirectStatus: 302,
      googleAds: { path: "$.gclidHash", equals: gclidHash },
      timestamp: {
        gte: new Date(occurredAt.getTime() - conversionAttributionWindowMs),
        lte: occurredAt,
      },
    },
    select: {
      clickId: true,
      providedNextHopHash: true,
      validatedNextHopHash: true,
      actualRedirectTargetHash: true,
      validationResult: true,
      redirectStatus: true,
    },
    take: 2,
  });
  if (!candidates.length) return { status: "NO_RECORDED_MATCH" } as const;
  if (candidates.length > 1) return { status: "AMBIGUOUS_IDENTIFIER" } as const;
  if (!hasRedirectIntegrity(candidates[0]))
    throw new ConversionError(422, "CLICK_INTEGRITY_INVALID");
  return {
    status: "MATCHED_RECORDED_REQUEST",
    clickId: candidates[0].clickId,
  } as const;
}
