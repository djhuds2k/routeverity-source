import { issueConversionKey } from "@/lib/routeverity/conversion-policy";
import { getHealthReport } from "@/lib/routeverity/health-monitor";
import { captureMerchantGclid } from "@/lib/routeverity/merchant-attribution";
import { reconcileMerchantBatch } from "@/lib/routeverity/merchant-ingestion";
import { merchantReconciliationMs } from "@/lib/routeverity/merchant-policy";
import { pruneWorkspaceBatch } from "@/lib/routeverity/retention";
import {
  fingerprint,
  issueTrackingToken,
} from "@/lib/routeverity/transparent-policy";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  captureMerchantGclid as captureReferenceGclid,
  prepareMerchantConversion,
  submitMerchantConversion,
} from "../../../../../examples/merchant-reference/client.mjs";
import { assertLocalDatabase, signInWithEmail } from "./helpers";

const prisma = new PrismaClient();
const nonce = `merchant-${Date.now()}-${randomUUID().slice(0, 8)}`;
const projectId = `ws_${nonce}`;
const campaignId = `cmp_${nonce}`;
const goalId = `cvg_${nonce}`;
const domainId = `dom_${nonce}`;
const host = `${nonce}.example.test`;
const email = `${nonce}@routeverity.test`;
const destination = "https://shop.example.com/checkout?preserve=a+b#receipt";
const tracking = issueTrackingToken();
const key = issueConversionKey();
const gclid = `private_fixture_${randomUUID()}`;
let validated = false;

function payload(changes: Record<string, unknown> = {}) {
  return {
    campaign_id: campaignId,
    event: "purchase",
    order_id: `ORDER-${randomUUID()}`,
    currency: "GBP",
    revenue: "12.50",
    timestamp: new Date().toISOString(),
    measurement_consent: "granted",
    gclid_hash: fingerprint(gclid),
    ...changes,
  };
}
function post(
  request: APIRequestContext,
  data = payload(),
  idempotency = randomUUID(),
  token = key.token,
) {
  return request.post("/api/v1/merchant-conversions", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotency,
    },
    data,
  });
}
async function track(request: APIRequestContext) {
  const response = await request.get(
    `/click?${new URLSearchParams({
      url: destination,
      rv_campaign: campaignId,
      rv_token: tracking.token,
      gclid,
    })}`,
    { headers: { Host: host }, maxRedirects: 0 },
  );
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
}
async function clearEvents() {
  await prisma.routeVerityMerchantReceipt.deleteMany({ where: { projectId } });
  await prisma.routeVerityMerchantSubmission.deleteMany({
    where: { projectId },
  });
  await prisma.routeVerityConversionReceipt.deleteMany({
    where: { projectId },
  });
  await prisma.routeVerityConversion.deleteMany({ where: { projectId } });
  await prisma.routeVerityRedirectAudit.deleteMany({ where: { projectId } });
}

function referenceEnvelope(query = `?gclid=${gclid}`, revenue = "99.99") {
  const envelope = prepareMerchantConversion(
    {
      campaign_id: campaignId,
      event: "purchase",
      order_id: `REFERENCE-${randomUUID()}`,
      currency: "GBP",
      revenue,
      timestamp: new Date().toISOString(),
    },
    captureReferenceGclid(query, "granted"),
    "granted",
  );
  if (
    !("body" in envelope) ||
    typeof envelope.body !== "string" ||
    typeof envelope.idempotencyKey !== "string"
  )
    throw new Error("REFERENCE_FIXTURE_ENVELOPE_NOT_READY");
  return envelope;
}

function referenceOptions(envelope: ReturnType<typeof referenceEnvelope>) {
  return {
    origin: "http://localhost:8888",
    conversionKey: key.token,
    envelope,
    currentConsent: "granted",
    allowLoopbackHttp: true,
  };
}

async function sendReference(envelope: ReturnType<typeof referenceEnvelope>) {
  const result = await submitMerchantConversion(referenceOptions(envelope));
  if (!("submission_id" in result))
    throw new Error("REFERENCE_FIXTURE_EXPECTED_API_RESULT");
  return result;
}

test.beforeAll(async () => {
  assertLocalDatabase();
  validated = true;
  const owner = await prisma.user.create({
    data: { email, emailVerified: new Date() },
  });
  await prisma.project.create({
    data: {
      id: projectId,
      name: "Merchant ingestion acceptance",
      slug: nonce,
      billingCycleStart: 1,
      users: { create: { userId: owner.id, role: "owner" } },
      domains: {
        create: {
          id: domainId,
          slug: host,
          type: "TRANSPARENT_TRACKING",
          verified: true,
        },
      },
    },
  });
  await prisma.routeVerityCampaign.create({
    data: {
      id: campaignId,
      projectId,
      name: "Merchant acceptance",
      advertiser: "Local fixture",
      status: "ACTIVE",
      trackingParameters: {},
      trackingDomainId: domainId,
      trackingTokenHash: tracking.hash,
      trackingTokenIssuedAt: new Date(),
      destinationDomains: { create: { hostname: "shop.example.com" } },
    },
  });
  await prisma.routeVerityConversionGoal.create({
    data: {
      id: goalId,
      projectId,
      campaignId,
      name: "Purchase",
      event: "purchase",
      currency: "GBP",
    },
  });
  await prisma.routeVerityConversionKey.create({
    data: {
      id: key.id,
      projectId,
      name: "Merchant fixture",
      tokenHash: key.hash,
    },
  });
});
test.beforeEach(async () => {
  await clearEvents();
  await prisma.project.update({
    where: { id: projectId },
    data: { disabledAt: null, routeverityRetentionDays: 30 },
  });
  await prisma.routeVerityConversionKey.update({
    where: { id: key.id },
    data: { revokedAt: null },
  });
  await prisma.routeVerityConversionGoal.update({
    where: { id: goalId },
    data: { enabled: true },
  });
});
test.afterAll(async () => {
  if (validated) {
    await clearEvents();
    await prisma.routeVerityConversionKey.deleteMany({ where: { projectId } });
    await prisma.routeVerityConversionGoal.deleteMany({ where: { projectId } });
    await prisma.routeVerityDestinationDomain.deleteMany({
      where: { campaignId },
    });
    await prisma.routeVerityCampaign.deleteMany({ where: { projectId } });
    await prisma.domain.deleteMany({ where: { projectId } });
    await prisma.projectUsers.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    const owner = await prisma.user.findUnique({ where: { email } });
    if (owner) {
      await prisma.session.deleteMany({ where: { userId: owner.id } });
      await prisma.user.delete({ where: { id: owner.id } });
    }
    await expect(
      prisma.project.count({ where: { id: projectId } }),
    ).resolves.toBe(0);
    await expect(prisma.user.count({ where: { email } })).resolves.toBe(0);
    await expect(
      prisma.routeVerityMerchantSubmission.count({ where: { projectId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.routeVerityMerchantReceipt.count({ where: { projectId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.routeVerityConversion.count({ where: { projectId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.routeVerityRedirectAudit.count({ where: { projectId } }),
    ).resolves.toBe(0);
  }
  await prisma.$disconnect();
});

test("standalone reference -> real local API -> concurrent retries preserve one exact-revenue conversion", async ({
  request,
}) => {
  await track(request);
  const envelope = referenceEnvelope();
  const [first, concurrent] = await Promise.all([
    sendReference(envelope),
    sendReference(envelope),
  ]);
  expect(first.status).toBe("ATTRIBUTED");
  expect(concurrent.submission_id).toBe(first.submission_id);
  expect([first.duplicate, concurrent.duplicate].sort()).toEqual([false, true]);
  const stored = await prisma.routeVerityMerchantSubmission.findUniqueOrThrow({
    where: { id: first.submission_id },
  });
  const retry = await sendReference(envelope);
  expect(retry).toMatchObject({
    submission_id: first.submission_id,
    conversion_id: first.conversion_id,
    status: "ATTRIBUTED",
    reason: "MATCHED_RECORDED_REQUEST",
    duplicate: true,
  });
  const conversion = await prisma.routeVerityConversion.findUniqueOrThrow({
    where: { id: first.conversion_id },
  });
  expect(conversion.revenue.toFixed(3)).toBe("99.990");
  expect(conversion.occurredAt.toISOString()).toBe(
    JSON.parse(envelope.body).timestamp,
  );
  expect(conversion.receivedAt).toEqual(stored.receivedAt);
  expect(stored.gclidHash).toBeNull();
  expect(JSON.stringify(stored)).not.toContain(gclid);
  await expect(
    prisma.routeVerityConversion.count({ where: { projectId } }),
  ).resolves.toBe(1);
  await expect(
    prisma.routeVerityMerchantReceipt.count({ where: { projectId } }),
  ).resolves.toBe(1);
  const changed = {
    ...envelope,
    body: JSON.stringify({
      ...JSON.parse(envelope.body),
      revenue: "100.00",
    }),
  };
  await expect(sendReference(changed)).rejects.toMatchObject({
    code: "MERCHANT_HTTP_REJECTED",
    httpStatus: 409,
    retryable: false,
  });
});

test("standalone reference preserves actual missing/ambiguous terminal outcomes without attributed revenue", async ({
  request,
}) => {
  const missing = await sendReference(referenceEnvelope(""));
  expect(missing).toMatchObject({
    status: "UNATTRIBUTED",
    reason: "MISSING_IDENTIFIER",
    conversion_id: null,
  });
  await track(request);
  await track(request);
  const ambiguous = await sendReference(referenceEnvelope());
  expect(ambiguous).toMatchObject({
    status: "UNATTRIBUTED",
    reason: "AMBIGUOUS_IDENTIFIER",
    conversion_id: null,
  });
  const rows = await prisma.routeVerityMerchantSubmission.findMany({
    where: { projectId },
  });
  expect(rows).toHaveLength(2);
  expect(rows.every((row) => row.gclidHash === null)).toBe(true);
  expect(rows.map((row) => row.revenue.toFixed(3))).toEqual([
    "99.990",
    "99.990",
  ]);
  await expect(
    prisma.routeVerityConversion.count({ where: { projectId } }),
  ).resolves.toBe(0);
});

test("standalone reference preserves pending receipt/deadline and suppresses withdrawn-consent dispatch", async () => {
  const envelope = referenceEnvelope();
  const first = await sendReference(envelope);
  expect(first).toMatchObject({
    status: "PENDING",
    reason: "NO_RECORDED_MATCH",
    conversion_id: null,
    duplicate: false,
  });
  const original = await prisma.routeVerityMerchantSubmission.findUniqueOrThrow(
    {
      where: { id: first.submission_id },
    },
  );
  const retry = await sendReference(envelope);
  expect(retry).toMatchObject({
    submission_id: first.submission_id,
    status: "PENDING",
    duplicate: true,
    reconcile_until: first.reconcile_until,
  });
  const retried = await prisma.routeVerityMerchantSubmission.findUniqueOrThrow({
    where: { id: first.submission_id },
  });
  expect(retried.occurredAt).toEqual(original.occurredAt);
  expect(retried.receivedAt).toEqual(original.receivedAt);
  expect(retried.reconcileUntil).toEqual(original.reconcileUntil);
  expect(retried.reconcileUntil.getTime() - retried.receivedAt.getTime()).toBe(
    merchantReconciliationMs,
  );
  const beforeWithdrawal = await prisma.routeVerityMerchantSubmission.count({
    where: { projectId },
  });
  const denied = await submitMerchantConversion({
    ...referenceOptions(referenceEnvelope()),
    currentConsent: "denied",
  });
  expect(denied).toEqual({ status: "CONSENT_NOT_GRANTED" });
  await expect(
    prisma.routeVerityMerchantSubmission.count({ where: { projectId } }),
  ).resolves.toBe(beforeWithdrawal);
  await expect(
    prisma.routeVerityMerchantReceipt.count({ where: { projectId } }),
  ).resolves.toBe(1);
  await expect(
    prisma.routeVerityConversion.count({ where: { projectId } }),
  ).resolves.toBe(0);
});

test("merchant-owned landing context -> public endpoint -> concurrent exact revenue/dedupe and labelled reporting", async ({
  request,
  page,
}) => {
  const capture = captureMerchantGclid(`?gclid=${gclid}`, "granted");
  expect(capture.status).toBe("READY");
  if (capture.status !== "READY")
    throw new Error("Fixture merchant capture failed");
  await track(request);
  const data = payload({ gclid_hash: capture.gclidHash, revenue: "99.99" });
  const idem = randomUUID();
  const responses = await Promise.all([
    post(request, data, idem),
    post(request, data, idem),
  ]);
  expect(responses.map((response) => response.status()).sort()).toEqual([
    200, 201,
  ]);
  const first = await responses[0].json();
  expect(first.status).toBe("ATTRIBUTED");
  const retry = await post(request, data);
  expect(retry.status()).toBe(200);
  expect((await retry.json()).submission_id).toBe(first.submission_id);
  expect(
    (await post(request, { ...data, revenue: "100" }, idem)).status(),
  ).toBe(409);
  expect((await post(request, { ...data, revenue: "100" })).status()).toBe(409);
  const rows = await prisma.routeVerityConversion.findMany({
    where: { projectId },
  });
  expect(rows).toHaveLength(1);
  expect(rows[0].revenue.toFixed(3)).toBe("99.990");
  expect(rows[0].attributionPolicy).toBe(
    "merchant-gclid-recorded-request-30d-v1",
  );
  const stored = await prisma.routeVerityMerchantSubmission.findUniqueOrThrow({
    where: { id: first.submission_id },
  });
  expect(stored.gclidHash).toBeNull();
  expect(JSON.stringify(stored)).not.toContain(gclid);
  await signInWithEmail(page, email);
  await page.goto(`/app/${nonce}/conversions`);
  await expect(page.getByTestId("conversion-total")).toHaveText("1");
  await expect(page.getByTestId("revenue-GBP")).toHaveText("GBP 99.990");
  await expect(page.getByTestId("merchant-unmatched-total")).toHaveText("0");
});

test("conversion arrives before durable evidence; bounded concurrent reconciliation preserves timestamp and receipt", async ({
  request,
}) => {
  await track(request);
  const audit = await prisma.routeVerityRedirectAudit.findFirstOrThrow({
    where: { projectId },
  });
  await prisma.routeVerityRedirectAudit.deleteMany({ where: { projectId } });
  const data = payload();
  const idem = randomUUID();
  const accepted = await post(request, data, idem);
  expect(accepted.status()).toBe(201);
  const pending = await accepted.json();
  expect(pending.status).toBe("PENDING");
  const initial = await prisma.routeVerityMerchantSubmission.findUniqueOrThrow({
    where: { id: pending.submission_id },
  });
  expect(initial.reconcileUntil.getTime() - initial.receivedAt.getTime()).toBe(
    merchantReconciliationMs,
  );
  await expect(
    prisma.routeVerityConversion.count({ where: { projectId } }),
  ).resolves.toBe(0);
  // Reinsert the same earlier prepared-request evidence to model delayed visibility, not a later click.
  await prisma.routeVerityRedirectAudit.create({
    data: {
      ...audit,
      googleAds: { gclidHash: fingerprint(gclid) },
    },
  });
  await prisma.routeVerityMerchantSubmission.update({
    where: { id: initial.id },
    data: { nextAttemptAt: new Date() },
  });
  await Promise.all([reconcileMerchantBatch(), reconcileMerchantBatch()]);
  const retry = await post(request, data, idem);
  const resolved = await retry.json();
  expect(resolved.status).toBe("ATTRIBUTED");
  const conversion = await prisma.routeVerityConversion.findUniqueOrThrow({
    where: { id: resolved.conversion_id },
  });
  expect(conversion.occurredAt.toISOString()).toBe(data.timestamp);
  expect(conversion.receivedAt).toEqual(initial.receivedAt);
  await expect(
    prisma.routeVerityConversion.count({ where: { projectId } }),
  ).resolves.toBe(1);
});

test("missing and repeated evidence remain terminal unmatched and excluded from revenue; no raw identifiers exported", async ({
  request,
  page,
}) => {
  await track(request);
  await track(request);
  const repeated = await post(request);
  expect(await repeated.json()).toMatchObject({
    status: "UNATTRIBUTED",
    reason: "AMBIGUOUS_IDENTIFIER",
    conversion_id: null,
  });
  const missingData = payload({ gclid_hash: undefined });
  const missing = await post(request, missingData);
  expect(await missing.json()).toMatchObject({
    status: "UNATTRIBUTED",
    reason: "MISSING_IDENTIFIER",
  });
  await signInWithEmail(page, email);
  await page.goto(`/app/${nonce}/conversions`);
  await expect(page.getByTestId("conversion-total")).toHaveText("0");
  await expect(page.getByTestId("merchant-unmatched-total")).toHaveText("2");
  await expect(page.getByTestId("merchant-UNATTRIBUTED-GBP")).toHaveText(
    "UNATTRIBUTED: 2 / GBP 25.000",
  );
  const exported = await page.request.get(`/app/${nonce}/settings/export`);
  expect(exported.status()).toBe(200);
  const output = await exported.json();
  expect(output.merchantSubmissions).toHaveLength(2);
  for (const row of output.merchantSubmissions) {
    expect(row).not.toHaveProperty("gclidHash");
    expect(row).not.toHaveProperty("payloadHash");
    expect(row).not.toHaveProperty("credentialId");
  }
  expect((await reconcileMerchantBatch()).processed).toBe(0);
});

test("24-hour expiry is terminal; retries do not extend deadlines; revoked keys and disabled goals stop reconciliation", async ({
  request,
}) => {
  const data = payload();
  const idem = randomUUID();
  const response = await post(request, data, idem);
  const body = await response.json();
  const stored = await prisma.routeVerityMerchantSubmission.findUniqueOrThrow({
    where: { id: body.submission_id },
  });
  expect((await post(request, data, idem)).status()).toBe(200);
  const retried = await prisma.routeVerityMerchantSubmission.findUniqueOrThrow({
    where: { id: stored.id },
  });
  expect(retried.reconcileUntil).toEqual(stored.reconcileUntil);
  expect(retried.attempts).toBe(stored.attempts);
  await reconcileMerchantBatch(stored.reconcileUntil);
  const expired = await post(request, data, idem);
  expect(await expired.json()).toMatchObject({
    status: "UNATTRIBUTED",
    reason: "RECONCILIATION_EXPIRED",
  });
  const revokeResponse = await post(request);
  const revoke = await revokeResponse.json();
  await prisma.routeVerityConversionKey.update({
    where: { id: key.id },
    data: { revokedAt: new Date() },
  });
  await prisma.routeVerityMerchantSubmission.update({
    where: { id: revoke.submission_id },
    data: { nextAttemptAt: new Date() },
  });
  await reconcileMerchantBatch();
  expect(
    (
      await prisma.routeVerityMerchantSubmission.findUniqueOrThrow({
        where: { id: revoke.submission_id },
      })
    ).reason,
  ).toBe("CREDENTIAL_REVOKED");
  expect((await post(request)).status()).toBe(401);
  await prisma.routeVerityConversionKey.update({
    where: { id: key.id },
    data: { revokedAt: null },
  });
  const disabledResponse = await post(request);
  const disabled = await disabledResponse.json();
  await prisma.routeVerityConversionGoal.update({
    where: { id: goalId },
    data: { enabled: false },
  });
  await prisma.routeVerityMerchantSubmission.update({
    where: { id: disabled.submission_id },
    data: { nextAttemptAt: new Date() },
  });
  await reconcileMerchantBatch();
  expect(
    (
      await prisma.routeVerityMerchantSubmission.findUniqueOrThrow({
        where: { id: disabled.submission_id },
      })
    ).reason,
  ).toBe("GOAL_UNAVAILABLE");
});

test("tenant, consent, strict JSON, tracking token, occurrence and method gates cannot write merchant events", async ({
  request,
}) => {
  expect(
    (
      await post(request, payload({ campaign_id: `${campaignId}-foreign` }))
    ).status(),
  ).toBe(404);
  expect(
    (await post(request, payload({ measurement_consent: "denied" }))).status(),
  ).toBe(403);
  expect(
    (await post(request, payload({ measurement_consent: "unknown" }))).status(),
  ).toBe(403);
  expect(
    (
      await post(
        request,
        payload({ timestamp: new Date(Date.now() + 60_000).toISOString() }),
      )
    ).status(),
  ).toBe(400);
  expect((await post(request, payload({ gclid }))).status()).toBe(400);
  expect(
    (await post(request, payload(), randomUUID(), tracking.token)).status(),
  ).toBe(401);
  expect((await request.get("/api/v1/merchant-conversions")).status()).toBe(
    405,
  );
  const duplicate = await request.post("/api/v1/merchant-conversions", {
    headers: {
      Authorization: `Bearer ${key.token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    data: JSON.stringify(payload()).replace(
      '"event":"purchase"',
      '"event":"purchase","event":"purchase"',
    ),
  });
  expect(duplicate.status()).toBe(400);
  await expect(
    prisma.routeVerityMerchantSubmission.count({ where: { projectId } }),
  ).resolves.toBe(0);
  await prisma.project.update({
    where: { id: projectId },
    data: { disabledAt: new Date() },
  });
  expect((await post(request)).status()).toBe(403);
});

test("direct and merchant orders cannot be double-counted across endpoints", async ({
  request,
}) => {
  await track(request);
  const audit = await prisma.routeVerityRedirectAudit.findFirstOrThrow({
    where: { projectId },
  });
  const data = payload({ gclid_hash: undefined });
  const merchant = await post(request, data);
  expect((await merchant.json()).status).toBe("UNATTRIBUTED");
  const directPayload = {
    click_id: audit.clickId,
    event: data.event,
    order_id: data.order_id,
    currency: data.currency,
    revenue: data.revenue,
    timestamp: data.timestamp,
  };
  const direct = await request.post("/api/v1/conversions", {
    headers: {
      Authorization: `Bearer ${key.token}`,
      "Idempotency-Key": randomUUID(),
    },
    data: directPayload,
  });
  expect(direct.status()).toBe(409);
  expect((await direct.json()).error).toBe("MERCHANT_ORDER_RESERVED");
  const otherOrder = `DIRECT-${randomUUID()}`;
  const directFirst = await request.post("/api/v1/conversions", {
    headers: {
      Authorization: `Bearer ${key.token}`,
      "Idempotency-Key": randomUUID(),
    },
    data: { ...directPayload, order_id: otherOrder },
  });
  expect(directFirst.status()).toBe(201);
  expect(
    (await post(request, payload({ order_id: otherOrder }))).status(),
  ).toBe(409);
  await expect(
    prisma.routeVerityConversion.count({ where: { projectId } }),
  ).resolves.toBe(1);
});

test("new backlog/expiry health signals and bounded receipt-first retention cover unmatched data", async ({
  request,
}) => {
  const accepted = await post(request);
  const body = await accepted.json();
  const overdue = new Date(Date.now() - 20 * 60_000);
  await prisma.routeVerityMerchantSubmission.update({
    where: { id: body.submission_id },
    data: { nextAttemptAt: overdue },
  });
  const health = await getHealthReport();
  expect(health.snapshot?.merchantPending).toBe(true);
  expect(health.issues.map((issue) => issue.code)).toContain(
    "MERCHANT_RECONCILIATION_OVERDUE",
  );
  const expiredAt = new Date(Date.now() - 31 * 86400000);
  await prisma.routeVerityMerchantSubmission.update({
    where: { id: body.submission_id },
    data: { receivedAt: expiredAt },
  });
  const preview = await pruneWorkspaceBatch(projectId, new Date(), false, 1);
  expect(preview.merchantSubmissions).toBe(1);
  expect(preview.merchantReceipts).toBe(1);
  await expect(
    prisma.routeVerityMerchantSubmission.count({ where: { projectId } }),
  ).resolves.toBe(1);
  await pruneWorkspaceBatch(projectId, new Date(), true, 1);
  await expect(
    prisma.routeVerityMerchantReceipt.count({ where: { projectId } }),
  ).resolves.toBe(0);
  await expect(
    prisma.routeVerityMerchantSubmission.count({ where: { projectId } }),
  ).resolves.toBe(0);
});
