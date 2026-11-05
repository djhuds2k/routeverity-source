import { z } from "zod";
import {
  ConversionError,
  conversionPayloadSchema,
  normalizeRevenue,
} from "./conversion-policy";
import { fingerprint } from "./transparent-policy";

export const merchantAttributionPolicy =
  "merchant-gclid-recorded-request-30d-v1";
export const merchantReconciliationMs = 24 * 60 * 60_000;
export const merchantRetryMs = 5 * 60_000;

const merchantPayloadSchema = conversionPayloadSchema
  .omit({ click_id: true, customer_reference: true, metadata: true })
  .extend({
    campaign_id: z.string().regex(/^cmp_[A-Za-z0-9_-]{8,64}$/),
    measurement_consent: z.enum(["granted", "denied", "unknown"]),
    gclid_hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    timestamp: z.string().datetime({ offset: true }),
  })
  .strict();

export function parseMerchantPayload(input: unknown, now = new Date()) {
  const parsed = merchantPayloadSchema.safeParse(input);
  if (!parsed.success)
    throw new ConversionError(400, "INVALID_MERCHANT_PAYLOAD");
  const data = parsed.data;
  if (data.measurement_consent !== "granted")
    throw new ConversionError(403, "MEASUREMENT_CONSENT_REQUIRED");
  const occurredAt = new Date(data.timestamp);
  const calendarDate = data.timestamp.slice(0, 10);
  const calendar = new Date(`${calendarDate}T00:00:00Z`);
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(occurredAt.getTime()) ||
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== calendarDate ||
    occurredAt > now
  )
    throw new ConversionError(400, "INVALID_CONVERSION_TIME");
  const normalized = {
    campaign_id: data.campaign_id,
    event: data.event,
    order_id: data.order_id,
    revenue: normalizeRevenue(data.revenue, data.currency),
    currency: data.currency,
    timestamp: occurredAt.toISOString(),
    gclid_hash: data.gclid_hash ?? null,
    measurement_consent: data.measurement_consent,
  };
  return {
    ...normalized,
    occurredAt,
    payloadHash: fingerprint(JSON.stringify(normalized)),
  };
}
