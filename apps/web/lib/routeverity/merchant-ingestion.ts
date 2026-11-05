import { prisma } from "@/lib/prisma";
import { Prisma, type RouteVerityMerchantSubmission } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  ConversionError,
  idempotencyHash,
  parseConversionPayload,
  validateConversionTime,
} from "./conversion-policy";
import { readConversionJson } from "./conversion-request";
import { resolveMerchantCandidateInTransaction } from "./merchant-attribution";
import {
  merchantAttributionPolicy,
  merchantReconciliationMs,
  merchantRetryMs,
  parseMerchantPayload,
} from "./merchant-policy";
import { allowRequest } from "./rate-limit";
import { validateRetentionBatchSize } from "./retention-policy";
import { fingerprint } from "./transparent-policy";

async function lockWorkspace(tx: Prisma.TransactionClient, projectId: string) {
  const locked = await tx.project.updateMany({
    where: { id: projectId, disabledAt: null },
    data: { updatedAt: new Date() },
  });
  return locked.count > 0;
}

async function resolveSubmission(
  tx: Prisma.TransactionClient,
  submission: RouteVerityMerchantSubmission,
  now: Date,
) {
  const update = (data: Prisma.RouteVerityMerchantSubmissionUpdateInput) =>
    tx.routeVerityMerchantSubmission.update({
      where: { id: submission.id },
      data: { ...data, attempts: { increment: 1 } },
    });
  const unmatched = (reason: string) =>
    update({ status: "UNATTRIBUTED", reason, gclidHash: null });
  if (!submission.gclidHash) return unmatched("MISSING_IDENTIFIER");
  if (now >= submission.reconcileUntil)
    return unmatched("RECONCILIATION_EXPIRED");
  const key = await tx.routeVerityConversionKey.findFirst({
    where: {
      id: submission.credentialId,
      projectId: submission.projectId,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!key) return unmatched("CREDENTIAL_REVOKED");
  const goal = await tx.routeVerityConversionGoal.findFirst({
    where: {
      id: submission.goalId,
      projectId: submission.projectId,
      campaignId: submission.campaignId,
      enabled: true,
    },
  });
  if (!goal) return unmatched("GOAL_UNAVAILABLE");
  const candidate = await resolveMerchantCandidateInTransaction(
    tx,
    {
      projectId: submission.projectId,
      campaignId: submission.campaignId,
      gclidHash: submission.gclidHash,
      occurredAt: submission.occurredAt,
    },
    now,
  );
  if (candidate.status === "AMBIGUOUS_IDENTIFIER")
    return unmatched("AMBIGUOUS_IDENTIFIER");
  if (candidate.status === "NO_RECORDED_MATCH")
    return update({
      reason: "NO_RECORDED_MATCH",
      nextAttemptAt: new Date(
        Math.min(
          now.getTime() + merchantRetryMs,
          submission.reconcileUntil.getTime(),
        ),
      ),
    });
  const click = await tx.routeVerityRedirectAudit.findFirstOrThrow({
    where: {
      projectId: submission.projectId,
      campaignId: submission.campaignId,
      clickId: candidate.clickId,
    },
    select: { timestamp: true },
  });
  validateConversionTime(click.timestamp, submission.occurredAt, now);
  const payload = parseConversionPayload({
    click_id: candidate.clickId,
    event: submission.event,
    order_id: submission.orderId,
    revenue: submission.revenue.toFixed(3),
    currency: submission.currency,
    timestamp: submission.occurredAt.toISOString(),
  });
  const existing = await tx.routeVerityConversion.findUnique({
    where: {
      projectId_goalId_orderHash: {
        projectId: submission.projectId,
        goalId: submission.goalId,
        orderHash: submission.orderHash,
      },
    },
  });
  if (existing && existing.payloadHash !== payload.payloadHash)
    return unmatched("ORDER_REFERENCE_CONFLICT");
  const conversion =
    existing ??
    (await tx.routeVerityConversion.create({
      data: {
        id: `cnv_${randomUUID()}`,
        projectId: submission.projectId,
        campaignId: submission.campaignId,
        goalId: submission.goalId,
        clickId: candidate.clickId,
        event: submission.event,
        orderId: submission.orderId,
        orderHash: submission.orderHash,
        revenue: submission.revenue,
        currency: submission.currency,
        occurredAt: submission.occurredAt,
        // Expiry must not extend simply because reconciliation was delayed.
        receivedAt: submission.receivedAt,
        metadata: {},
        payloadHash: payload.payloadHash,
        attributionPolicy: merchantAttributionPolicy,
      },
    }));
  return update({
    status: "ATTRIBUTED",
    reason: "MATCHED_RECORDED_REQUEST",
    conversionId: conversion.id,
    gclidHash: null,
  });
}

export async function merchantConversionIngestion(request: Request) {
  const requestId = randomUUID();
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-RouteVerity-Request-Id": requestId,
  });
  try {
    if (request.method !== "POST")
      throw new ConversionError(405, "METHOD_NOT_ALLOWED");
    if (new URL(request.url).search)
      throw new ConversionError(400, "POST_QUERY_NOT_SUPPORTED");
    const match = request.headers
      .get("authorization")
      ?.match(/^Bearer (rvcv_[A-Za-z0-9_-]{43})$/);
    if (!match) throw new ConversionError(401, "INVALID_CONVERSION_CREDENTIAL");
    const key = await prisma.routeVerityConversionKey.findUnique({
      where: { tokenHash: fingerprint(match[1]) },
    });
    if (!key || key.revokedAt)
      throw new ConversionError(401, "INVALID_CONVERSION_CREDENTIAL");
    if (!(await allowRequest("conversion-ingestion", key.projectId, 600, 60)))
      throw new ConversionError(429, "CONVERSION_RATE_LIMITED");
    const hash = idempotencyHash(request.headers.get("idempotency-key"));
    const payload = parseMerchantPayload(await readConversionJson(request));
    const result = await prisma.$transaction(
      async (tx) => {
        if (!(await lockWorkspace(tx, key.projectId)))
          throw new ConversionError(403, "WORKSPACE_UNAVAILABLE");
        if (
          !(await tx.routeVerityConversionKey.findFirst({
            where: { id: key.id, projectId: key.projectId, revokedAt: null },
            select: { id: true },
          }))
        )
          throw new ConversionError(401, "INVALID_CONVERSION_CREDENTIAL");
        const receipt = await tx.routeVerityMerchantReceipt.findUnique({
          where: {
            projectId_keyHash: { projectId: key.projectId, keyHash: hash },
          },
        });
        if (receipt) {
          if (receipt.payloadHash !== payload.payloadHash)
            throw new ConversionError(409, "IDEMPOTENCY_CONFLICT");
          const submission =
            await tx.routeVerityMerchantSubmission.findFirstOrThrow({
              where: { id: receipt.submissionId, projectId: key.projectId },
            });
          return { submission, duplicate: true };
        }
        const goal = await tx.routeVerityConversionGoal.findUnique({
          where: {
            projectId_campaignId_event: {
              projectId: key.projectId,
              campaignId: payload.campaign_id,
              event: payload.event,
            },
          },
        });
        if (!goal) throw new ConversionError(404, "GOAL_UNAVAILABLE");
        if (goal.currency !== payload.currency)
          throw new ConversionError(400, "GOAL_CURRENCY_MISMATCH");
        const existing = await tx.routeVerityMerchantSubmission.findUnique({
          where: {
            projectId_goalId_orderHash: {
              projectId: key.projectId,
              goalId: goal.id,
              orderHash: fingerprint(payload.order_id),
            },
          },
        });
        if (existing && existing.payloadHash !== payload.payloadHash)
          throw new ConversionError(409, "ORDER_REFERENCE_CONFLICT");
        let submission = existing;
        if (!submission) {
          if (!goal.enabled) throw new ConversionError(403, "GOAL_DISABLED");
          if (
            await tx.routeVerityConversion.findUnique({
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
            throw new ConversionError(409, "ORDER_REFERENCE_CONFLICT");
          const now = new Date();
          submission = await tx.routeVerityMerchantSubmission.create({
            data: {
              id: `mcv_${randomUUID()}`,
              projectId: key.projectId,
              campaignId: payload.campaign_id,
              goalId: goal.id,
              credentialId: key.id,
              event: payload.event,
              orderId: payload.order_id,
              orderHash: fingerprint(payload.order_id),
              revenue: new Prisma.Decimal(payload.revenue),
              currency: payload.currency,
              occurredAt: payload.occurredAt,
              receivedAt: now,
              gclidHash: payload.gclid_hash,
              payloadHash: payload.payloadHash,
              status: "PENDING",
              reason: "NO_RECORDED_MATCH",
              reconcileUntil: new Date(
                now.getTime() + merchantReconciliationMs,
              ),
              nextAttemptAt: now,
            },
          });
          submission = await resolveSubmission(tx, submission, now);
        }
        await tx.routeVerityMerchantReceipt.create({
          data: {
            id: `mcr_${randomUUID()}`,
            projectId: key.projectId,
            keyHash: hash,
            submissionId: submission.id,
            payloadHash: payload.payloadHash,
          },
        });
        return { submission, duplicate: !!existing };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
    const { submission, duplicate } = result;
    console.info(
      JSON.stringify({
        event: "routeverity.merchant.accepted",
        request_id: requestId,
        submission_id: submission.id,
        status: submission.status,
        reason: submission.reason,
        duplicate,
      }),
    );
    return Response.json(
      {
        submission_id: submission.id,
        status: submission.status,
        reason: submission.reason,
        conversion_id: submission.conversionId,
        duplicate,
        attribution_policy: merchantAttributionPolicy,
        reconcile_until: submission.reconcileUntil.toISOString(),
      },
      { status: duplicate ? 200 : 201, headers },
    );
  } catch (error) {
    const status = error instanceof ConversionError ? error.status : 503;
    const code =
      error instanceof ConversionError
        ? error.code
        : "MERCHANT_DEPENDENCY_UNAVAILABLE";
    const record = JSON.stringify({
      event: "routeverity.merchant.rejected",
      request_id: requestId,
      status,
      code,
    });
    if (status === 503) console.error(record);
    else console.warn(record);
    if (status === 405) headers.set("Allow", "POST");
    if (status === 401) headers.set("WWW-Authenticate", "Bearer");
    if (status === 429) headers.set("Retry-After", "60");
    return Response.json(
      { error: code, request_id: requestId },
      { status, headers },
    );
  }
}

export async function reconcileMerchantBatch(now = new Date(), limit = 100) {
  validateRetentionBatchSize(limit);
  if (!Number.isFinite(now.getTime()))
    throw new Error("Reconciliation requires a valid reference time.");
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT m.id FROM RouteVerityMerchantSubmission m
    INNER JOIN Project p ON p.id = m.projectId AND p.disabledAt IS NULL
    WHERE m.status = 'PENDING' AND m.nextAttemptAt <= ${now}
    ORDER BY m.nextAttemptAt ASC, m.id ASC LIMIT ${limit}
  `);
  let processed = 0;
  for (const row of rows) {
    await prisma.$transaction(
      async (tx) => {
        const initial = await tx.routeVerityMerchantSubmission.findUnique({
          where: { id: row.id },
        });
        if (!initial || !(await lockWorkspace(tx, initial.projectId))) return;
        const submission = await tx.routeVerityMerchantSubmission.findUnique({
          where: { id: row.id },
        });
        if (
          !submission ||
          submission.status !== "PENDING" ||
          submission.nextAttemptAt > now
        )
          return;
        await resolveSubmission(tx, submission, now);
        processed++;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );
  }
  return { scanned: rows.length, processed };
}
