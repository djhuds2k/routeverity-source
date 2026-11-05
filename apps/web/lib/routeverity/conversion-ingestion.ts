import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  conversionAttributionPolicy,
  ConversionError,
  idempotencyHash,
  parseConversionPayload,
  validateConversionTime,
} from "./conversion-policy";
import { readConversionJson } from "./conversion-request";
import { allowRequest } from "./rate-limit";
import { fingerprint, hasRedirectIntegrity } from "./transparent-policy";

function readPostback(request: Request) {
  const search = new URL(request.url).search;
  if (search.length > 8192)
    throw new ConversionError(413, "POSTBACK_TOO_LARGE");
  const query: Record<string, string> = {};
  for (const part of search.slice(1).split("&")) {
    const separator = part.indexOf("=");
    if (separator < 1) throw new ConversionError(400, "INVALID_POSTBACK");
    let key, value;
    try {
      key = decodeURIComponent(part.slice(0, separator).replace(/\+/g, " "));
      value = decodeURIComponent(part.slice(separator + 1).replace(/\+/g, " "));
    } catch {
      throw new ConversionError(400, "INVALID_POSTBACK_ENCODING");
    }
    if (Object.hasOwn(query, key))
      throw new ConversionError(400, "DUPLICATE_POSTBACK_PARAMETER");
    if (
      ![
        "click_id",
        "event",
        "order_id",
        "revenue",
        "currency",
        "customer_reference",
        "timestamp",
        "idempotency_key",
      ].includes(key)
    )
      throw new ConversionError(400, "UNSUPPORTED_POSTBACK_PARAMETER");
    query[key] = value;
  }
  const { idempotency_key: idempotencyKey, ...input } = query;
  // GET intentionally supports scalar fields only; metadata belongs in POST JSON.
  if (Object.hasOwn(input, "metadata"))
    throw new ConversionError(400, "POSTBACK_METADATA_NOT_SUPPORTED");
  return { input, idempotencyKey };
}

export async function conversionIngestion(request: Request) {
  const requestId = randomUUID();
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-RouteVerity-Request-Id": requestId,
  });
  try {
    if (!["GET", "POST"].includes(request.method))
      throw new ConversionError(405, "METHOD_NOT_ALLOWED");
    const authorization = request.headers.get("authorization");
    const match = authorization?.match(/^Bearer (rvcv_[A-Za-z0-9_-]{43})$/);
    if (!match) throw new ConversionError(401, "INVALID_CONVERSION_CREDENTIAL");
    const key = await prisma.routeVerityConversionKey.findUnique({
      where: { tokenHash: fingerprint(match[1]) },
    });
    if (!key || key.revokedAt)
      throw new ConversionError(401, "INVALID_CONVERSION_CREDENTIAL");
    if (!(await allowRequest("conversion-ingestion", key.projectId, 600, 60)))
      throw new ConversionError(429, "CONVERSION_RATE_LIMITED");
    let input: unknown;
    let idempotencyKey: string | null;
    if (request.method === "POST") {
      if (new URL(request.url).search)
        throw new ConversionError(400, "POST_QUERY_NOT_SUPPORTED");
      input = await readConversionJson(request);
      idempotencyKey = request.headers.get("idempotency-key");
    } else {
      const postback = readPostback(request);
      input = postback.input;
      idempotencyKey = postback.idempotencyKey ?? null;
      if (request.headers.has("idempotency-key"))
        throw new ConversionError(
          400,
          "POSTBACK_IDEMPOTENCY_HEADER_NOT_SUPPORTED",
        );
    }
    const hash = idempotencyHash(idempotencyKey);
    const payload = parseConversionPayload(input);
    const result = await prisma.$transaction(
      async (tx) => {
        // The same workspace lock orders configuration/revocation and ingestion.
        const locked = await tx.project.updateMany({
          where: { id: key.projectId, disabledAt: null },
          data: { updatedAt: new Date() },
        });
        if (!locked.count)
          throw new ConversionError(403, "WORKSPACE_UNAVAILABLE");
        const currentKey = await tx.routeVerityConversionKey.findFirst({
          where: { id: key.id, projectId: key.projectId, revokedAt: null },
        });
        if (!currentKey)
          throw new ConversionError(401, "INVALID_CONVERSION_CREDENTIAL");
        const receipt = await tx.routeVerityConversionReceipt.findUnique({
          where: {
            projectId_keyHash: { projectId: key.projectId, keyHash: hash },
          },
        });
        if (receipt) {
          if (receipt.payloadHash !== payload.payloadHash)
            throw new ConversionError(409, "IDEMPOTENCY_CONFLICT");
          return { id: receipt.conversionId, duplicate: true };
        }
        const click = await tx.routeVerityRedirectAudit.findFirst({
          where: {
            projectId: key.projectId,
            clickId: payload.click_id,
            validationResult: "ALLOWED",
            redirectStatus: 302,
          },
        });
        if (!click) throw new ConversionError(404, "CLICK_UNAVAILABLE");
        if (!hasRedirectIntegrity(click))
          throw new ConversionError(422, "CLICK_INTEGRITY_INVALID");
        const goal = await tx.routeVerityConversionGoal.findUnique({
          where: {
            projectId_campaignId_event: {
              projectId: key.projectId,
              campaignId: click.campaignId,
              event: payload.event,
            },
          },
        });
        if (!goal) throw new ConversionError(404, "GOAL_UNAVAILABLE");
        if (goal.currency !== payload.currency)
          throw new ConversionError(400, "GOAL_CURRENCY_MISMATCH");
        const existing = await tx.routeVerityConversion.findUnique({
          where: {
            projectId_goalId_orderHash: {
              projectId: key.projectId,
              goalId: goal.id,
              orderHash: fingerprint(payload.order_id),
            },
          },
        });
        if (existing) {
          if (existing.payloadHash !== payload.payloadHash)
            throw new ConversionError(409, "ORDER_REFERENCE_CONFLICT");
          await tx.routeVerityConversionReceipt.create({
            data: {
              id: `cvr_${randomUUID()}`,
              projectId: key.projectId,
              keyHash: hash,
              conversionId: existing.id,
              payloadHash: payload.payloadHash,
            },
          });
          return { id: existing.id, duplicate: true };
        }
        if (!goal.enabled) throw new ConversionError(403, "GOAL_DISABLED");
        if (
          await tx.routeVerityMerchantSubmission.findUnique({
            where: {
              projectId_goalId_orderHash: {
                projectId: key.projectId,
                goalId: goal.id,
                orderHash: fingerprint(payload.order_id),
              },
            },
            select: { id: true },
          })
        )
          throw new ConversionError(409, "MERCHANT_ORDER_RESERVED");
        const now = new Date();
        const occurredAt = payload.timestamp
          ? new Date(payload.timestamp)
          : now;
        validateConversionTime(click.timestamp, occurredAt, now);
        const conversion = await tx.routeVerityConversion.create({
          data: {
            id: `cnv_${randomUUID()}`,
            projectId: key.projectId,
            campaignId: click.campaignId,
            goalId: goal.id,
            clickId: click.clickId,
            event: payload.event,
            orderId: payload.order_id,
            orderHash: fingerprint(payload.order_id),
            customerReference: payload.customer_reference,
            revenue: new Prisma.Decimal(payload.revenue),
            currency: payload.currency,
            occurredAt,
            metadata: payload.metadata,
            payloadHash: payload.payloadHash,
            attributionPolicy: conversionAttributionPolicy,
          },
        });
        await tx.routeVerityConversionReceipt.create({
          data: {
            id: `cvr_${randomUUID()}`,
            projectId: key.projectId,
            keyHash: hash,
            conversionId: conversion.id,
            payloadHash: payload.payloadHash,
          },
        });
        return { id: conversion.id, duplicate: false };
      },
      { timeout: 10000 },
    );
    console.info(
      JSON.stringify({
        event: "routeverity.conversion.accepted",
        request_id: requestId,
        conversion_id: result.id,
        duplicate: result.duplicate,
      }),
    );
    return Response.json(
      {
        conversion_id: result.id,
        duplicate: result.duplicate,
        attribution_policy: conversionAttributionPolicy,
      },
      { status: result.duplicate ? 200 : 201, headers },
    );
  } catch (error) {
    const status = error instanceof ConversionError ? error.status : 503;
    const code =
      error instanceof ConversionError
        ? error.code
        : "CONVERSION_DEPENDENCY_UNAVAILABLE";
    const record = JSON.stringify({
      event: "routeverity.conversion.rejected",
      request_id: requestId,
      status,
      code,
    });
    if (status === 503) console.error(record);
    else console.warn(record);
    if (status === 405) headers.set("Allow", "POST, GET");
    if (status === 401) headers.set("WWW-Authenticate", "Bearer");
    if (status === 429) headers.set("Retry-After", "60");
    return Response.json(
      { error: code, request_id: requestId },
      { status, headers },
    );
  }
}
