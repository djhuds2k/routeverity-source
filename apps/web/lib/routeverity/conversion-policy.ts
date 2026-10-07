import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { currencies } from "./campaign-policy";
import { fingerprint } from "./transparent-policy";

export const conversionAttributionPolicy = "direct-click-30d-v1";
export class ConversionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
const boundedText = (limit: number) =>
  z
    .string()
    .min(1)
    .max(limit)
    .refine(
      (value) =>
        ![...value].some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ),
      "Control characters are not permitted.",
    );
export const eventSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const currencySchema = z
  .string()
  .refine(
    (value) => currencies.includes(value),
    "Use a supported uppercase ISO currency.",
  );
export const goalSchema = z
  .object({
    campaignId: boundedText(100),
    name: z.string().trim().min(2).max(120),
    event: eventSchema,
    currency: currencySchema,
  })
  .strict();
export const conversionPayloadSchema = z
  .object({
    click_id: z
      .string()
      .regex(
        /^rvc_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
    event: eventSchema,
    order_id: boundedText(120),
    revenue: z.union([z.string(), z.number().finite()]).default("0"),
    currency: currencySchema,
    customer_reference: boundedText(120).optional(),
    timestamp: z.string().datetime({ offset: true }).optional(),
    metadata: z
      .record(
        z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
        z.union([
          z.string().max(200),
          z.number().finite(),
          z.boolean(),
          z.null(),
        ]),
      )
      .default({})
      .refine(
        (value) =>
          Object.keys(value).length <= 10 &&
          Buffer.byteLength(JSON.stringify(value), "utf8") <= 2000,
        "Metadata allows at most ten bounded scalar fields and 2,000 UTF-8 bytes.",
      ),
  })
  .strict();

export function normalizeRevenue(value: string | number, currency: string) {
  const text = String(value);
  const digits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/.test(text))
    throw new ConversionError(400, "INVALID_REVENUE");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits)))
    throw new ConversionError(400, "INVALID_CURRENCY_PRECISION");
  return `${whole}.${fraction.padEnd(3, "0")}`;
}

export function parseConversionPayload(input: unknown) {
  const result = conversionPayloadSchema.safeParse(input);
  if (!result.success)
    throw new ConversionError(400, "INVALID_CONVERSION_PAYLOAD");
  const data = result.data;
  if (data.timestamp) {
    const calendarDate = data.timestamp.slice(0, 10);
    const calendar = new Date(`${calendarDate}T00:00:00Z`);
    if (
      Number.isNaN(new Date(data.timestamp).getTime()) ||
      Number.isNaN(calendar.getTime()) ||
      calendar.toISOString().slice(0, 10) !== calendarDate
    )
      throw new ConversionError(400, "INVALID_CONVERSION_TIME");
  }
  const metadata = Object.fromEntries(
    Object.entries(data.metadata).sort(([a], [b]) => a.localeCompare(b)),
  );
  const revenue = normalizeRevenue(data.revenue, data.currency);
  const timestamp = data.timestamp
    ? new Date(data.timestamp).toISOString()
    : null;
  const normalized = {
    click_id: data.click_id,
    event: data.event,
    order_id: data.order_id,
    revenue,
    currency: data.currency,
    customer_reference: data.customer_reference ?? null,
    timestamp,
    metadata,
  };
  return {
    ...normalized,
    payloadHash: fingerprint(JSON.stringify(normalized)),
  };
}
export type ConversionPayload = ReturnType<typeof parseConversionPayload>;

export function validateConversionTime(
  clickTime: Date,
  occurredAt: Date,
  now: Date,
) {
  if (
    Number.isNaN(occurredAt.getTime()) ||
    occurredAt < clickTime ||
    occurredAt > now
  )
    throw new ConversionError(400, "INVALID_CONVERSION_TIME");
  if (occurredAt.getTime() - clickTime.getTime() > 30 * 86400000)
    throw new ConversionError(422, "ATTRIBUTION_WINDOW_EXPIRED");
}

export function issueConversionKey() {
  const token = `rvcv_${randomBytes(32).toString("base64url")}`;
  return { id: `cvk_${randomUUID()}`, token, hash: fingerprint(token) };
}
export function idempotencyHash(value: string | null) {
  if (!value || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(value))
    throw new ConversionError(400, "INVALID_IDEMPOTENCY_KEY");
  return fingerprint(value);
}

export function parseUniqueJson(text: string): unknown {
  const result: unknown = JSON.parse(text);
  const stack: {
    kind: "object" | "array";
    keys: Set<string>;
    expectsKey: boolean;
  }[] = [];
  for (const token of text.matchAll(/"(?:\\.|[^"\\])*"|[{}[\],:]/g)) {
    const value = token[0];
    if (value === "{" || value === "[") {
      stack.push({
        kind: value === "{" ? "object" : "array",
        keys: new Set(),
        expectsKey: value === "{",
      });
    } else if (value === "}" || value === "]") {
      stack.pop();
    } else if (value === ",") {
      const scope = stack.at(-1);
      if (scope?.kind === "object") scope.expectsKey = true;
    } else if (value.startsWith('"')) {
      const scope = stack.at(-1);
      if (scope?.kind === "object" && scope.expectsKey) {
        const key: string = JSON.parse(value);
        if (scope.keys.has(key))
          throw new ConversionError(400, "DUPLICATE_JSON_FIELD");
        scope.keys.add(key);
        scope.expectsKey = false;
      }
    }
  }
  return result;
}
