import { createHash, randomUUID } from "node:crypto";

export class MerchantReferenceError extends Error {
  constructor(
    code,
    { httpStatus = null, retryable = false, retryAfterSeconds = null } = {},
  ) {
    super(code);
    this.name = "MerchantReferenceError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function hasConsent(consent) {
  if (!["granted", "denied", "unknown"].includes(consent))
    throw new MerchantReferenceError("INVALID_MEASUREMENT_CONSENT");
  return consent === "granted";
}

export function captureMerchantGclid(search, consent) {
  if (!hasConsent(consent)) return { status: "CONSENT_NOT_GRANTED" };
  if (typeof search !== "string" || search.length > 16384)
    throw new MerchantReferenceError("INVALID_MERCHANT_QUERY");
  const values = new URLSearchParams(search).getAll("gclid");
  if (values.length > 1) return { status: "AMBIGUOUS_IDENTIFIER" };
  if (!values.length || !values[0]) return { status: "MISSING_IDENTIFIER" };
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(values[0]))
    throw new MerchantReferenceError("INVALID_MERCHANT_IDENTIFIER");
  return {
    status: "READY",
    gclidHash: createHash("sha256").update(values[0], "utf8").digest("hex"),
  };
}

const orderFields = [
  "campaign_id",
  "event",
  "order_id",
  "revenue",
  "currency",
  "timestamp",
];
const payloadFields = [...orderFields, "measurement_consent", "gclid_hash"];
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const textMatches = (value, pattern) =>
  typeof value === "string" && pattern.test(value);
const isoTime = (value) =>
  textMatches(
    value,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
  ) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(`${value.slice(0, 10)}T00:00:00Z`)
    .toISOString()
    .startsWith(value.slice(0, 10));

function validatePayload(payload) {
  if (
    !record(payload) ||
    Object.keys(payload).some((key) => !payloadFields.includes(key)) ||
    payload.measurement_consent !== "granted" ||
    !textMatches(payload.campaign_id, /^cmp_[A-Za-z0-9_-]{8,64}$/) ||
    !textMatches(payload.event, /^[a-z][a-z0-9_-]{0,63}$/) ||
    !textMatches(payload.order_id, /^[^\u0000-\u001f\u007f]{1,120}$/) ||
    !textMatches(payload.revenue, /^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/) ||
    !textMatches(payload.currency, /^[A-Z]{3}$/) ||
    !isoTime(payload.timestamp) ||
    Date.parse(payload.timestamp) > Date.now() ||
    (payload.gclid_hash !== undefined &&
      !textMatches(payload.gclid_hash, /^[a-f0-9]{64}$/))
  )
    throw new MerchantReferenceError("INVALID_REFERENCE_PAYLOAD");
}

// Persist this envelope once in the merchant's approved outbox, not per retry.
export function prepareMerchantConversion(order, context, currentConsent) {
  if (!hasConsent(currentConsent)) return { status: "CONSENT_NOT_GRANTED" };
  if (
    !record(context) ||
    !["READY", "MISSING_IDENTIFIER"].includes(context.status) ||
    (context.status === "READY" &&
      !textMatches(context.gclidHash, /^[a-f0-9]{64}$/))
  )
    throw new MerchantReferenceError("INVALID_MERCHANT_CONTEXT");
  if (
    !record(order) ||
    Object.keys(order).some((key) => !orderFields.includes(key))
  )
    throw new MerchantReferenceError("INVALID_REFERENCE_ORDER");
  const payload = {
    ...order,
    measurement_consent: "granted",
    ...(context.status === "READY" ? { gclid_hash: context.gclidHash } : {}),
  };
  validatePayload(payload);
  return Object.freeze({
    status: "READY",
    idempotencyKey: `merchant:${randomUUID()}`,
    body: JSON.stringify(payload),
  });
}

const reasons = {
  ATTRIBUTED: ["MATCHED_RECORDED_REQUEST"],
  PENDING: ["NO_RECORDED_MATCH"],
  UNATTRIBUTED: [
    "MISSING_IDENTIFIER",
    "AMBIGUOUS_IDENTIFIER",
    "RECONCILIATION_EXPIRED",
    "CREDENTIAL_REVOKED",
    "GOAL_UNAVAILABLE",
    "ORDER_REFERENCE_CONFLICT",
  ],
};

async function readResult(response) {
  if (
    !response.headers.get("content-type")?.startsWith("application/json") ||
    !response.body
  )
    throw new MerchantReferenceError("INVALID_MERCHANT_RESPONSE", {
      retryable: true,
    });
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096)
        throw new MerchantReferenceError("INVALID_MERCHANT_RESPONSE", {
          retryable: true,
        });
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (
    !record(data) ||
    !textMatches(
      data.submission_id,
      /^mcv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    ) ||
    !Object.hasOwn(reasons, data.status) ||
    !reasons[data.status].includes(data.reason) ||
    data.attribution_policy !== "merchant-gclid-recorded-request-30d-v1" ||
    !isoTime(data.reconcile_until) ||
    data.duplicate !== (response.status === 200) ||
    (data.status === "ATTRIBUTED"
      ? !textMatches(
          data.conversion_id,
          /^cnv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        )
      : data.conversion_id != null)
  )
    throw new MerchantReferenceError("INVALID_MERCHANT_RESPONSE", {
      retryable: true,
    });
  return Object.freeze({
    submission_id: data.submission_id,
    status: data.status,
    reason: data.reason,
    conversion_id: data.conversion_id ?? null,
    duplicate: data.duplicate,
    attribution_policy: data.attribution_policy,
    reconcile_until: data.reconcile_until,
  });
}

export async function submitMerchantConversion({
  origin,
  conversionKey,
  envelope,
  currentConsent,
  allowLoopbackHttp = false,
  timeoutMs = 10000,
}) {
  if (!hasConsent(currentConsent)) return { status: "CONSENT_NOT_GRANTED" };
  let url;
  try {
    url = new URL(origin);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    throw new MerchantReferenceError("INVALID_REFERENCE_REQUEST");
  }
  const localHttp =
    allowLoopbackHttp === true &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !textMatches(conversionKey, /^rvcv_[A-Za-z0-9_-]{43}$/) ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30000 ||
    !record(envelope) ||
    envelope.status !== "READY" ||
    !textMatches(
      envelope.idempotencyKey,
      /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/,
    ) ||
    typeof envelope.body !== "string" ||
    Buffer.byteLength(envelope.body, "utf8") > 16384
  )
    throw new MerchantReferenceError("INVALID_REFERENCE_REQUEST");
  let payload;
  try {
    payload = JSON.parse(envelope.body);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new MerchantReferenceError("INVALID_REFERENCE_PAYLOAD");
  }
  validatePayload(payload);
  if (JSON.stringify(payload) !== envelope.body)
    throw new MerchantReferenceError("INVALID_REFERENCE_PAYLOAD");
  url.pathname = "/api/v1/merchant-conversions";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conversionKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": envelope.idempotencyKey,
      },
      body: envelope.body,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (![200, 201].includes(response.status)) {
      await response.body?.cancel();
      const retryAfter = response.headers.get("retry-after");
      throw new MerchantReferenceError("MERCHANT_HTTP_REJECTED", {
        httpStatus: response.status,
        retryable:
          [408, 429].includes(response.status) || response.status >= 500,
        retryAfterSeconds:
          retryAfter !== null && /^\d{1,8}$/.test(retryAfter)
            ? Number(retryAfter)
            : null,
      });
    }
    return await readResult(response);
  } catch (error) {
    if (error instanceof MerchantReferenceError) throw error;
    // A lost response can follow a committed write; reuse the original envelope.
    throw new MerchantReferenceError(
      "MERCHANT_TRANSPORT_OR_RESPONSE_UNCERTAIN",
      {
        retryable: true,
      },
    );
  }
}
