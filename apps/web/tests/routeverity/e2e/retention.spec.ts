import { prisma as workerDatabase } from "@/lib/prisma";
import {
  pruneGlobalBatch,
  pruneWorkspaceBatch,
} from "@/lib/routeverity/retention";
import { retentionCutoffs } from "@/lib/routeverity/retention-policy";
import { fingerprint } from "@/lib/routeverity/transparent-policy";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertLocalDatabase, signInWithEmail } from "./helpers";

const prisma = new PrismaClient();
const nonce = `retention-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
const projectId = `ws_${nonce}`;
const campaignId = `cmp_${nonce}`;
const goalId = `goal_${nonce}`;
const ownerEmail = `${nonce}@routeverity.test`;
const viewerEmail = `${nonce}-viewer@routeverity.test`;
const foreignEmail = `${nonce}-foreign@routeverity.test`;
const users: string[] = [];
const now = new Date();
const cutoff = retentionCutoffs(now, 90);
const clickIds = Array.from({ length: 6 }, () => `rvc_${randomUUID()}`);
const conversionIds = Array.from({ length: 4 }, () => `cnv_${randomUUID()}`);
const operatorIds = Array.from({ length: 3 }, () => `audit_${randomUUID()}`);
let validated = false;

test.beforeAll(async () => {
  assertLocalDatabase();
  validated = true;
  for (const email of [ownerEmail, viewerEmail, foreignEmail]) {
    const user = await prisma.user.create({
      data: { email, emailVerified: new Date() },
    });
    users.push(user.id);
  }
  await prisma.project.create({
    data: {
      id: projectId,
      slug: nonce,
      name: "Retention acceptance",
      billingCycleStart: 1,
      users: {
        create: [
          { userId: users[0], role: "owner" },
          { userId: users[1], role: "viewer" },
        ],
      },
    },
  });
  await prisma.routeVerityCampaign.create({
    data: {
      id: campaignId,
      projectId,
      name: "Retention fixture",
      advertiser: "Local test",
      trackingParameters: {},
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
      id: `key_${nonce}`,
      projectId,
      name: "Untouched configuration",
      tokenHash: fingerprint(nonce),
    },
  });
  const clickTimes = [
    new Date(cutoff.records.getTime() - 1),
    cutoff.records,
    new Date(cutoff.records.getTime() + 1),
    new Date(now.getTime() - 60 * 86_400_000 - 1),
    cutoff.rawUserAgent,
    new Date(cutoff.rawUserAgent.getTime() + 1),
  ];
  for (const [index, timestamp] of clickTimes.entries())
    await prisma.routeVerityRedirectAudit.create({
      data: {
        clickId: clickIds[index],
        requestId: randomUUID(),
        projectId,
        campaignId,
        timestamp,
        trackingDomain: "local.example.test",
        destinationHostname: "shop.example.test",
        providedNextHopHash: fingerprint("https://shop.example.test"),
        validatedNextHopHash: fingerprint("https://shop.example.test"),
        actualRedirectTargetHash: fingerprint("https://shop.example.test"),
        validationResult: "ALLOWED",
        redirectStatus: 302,
        processingTimeMs: 1,
        policyVersion: "retention-test",
        appVersion: "local-test",
        rawUserAgent: index >= 4 ? "Mozilla/5.0 Chrome/120.0" : null,
        analyticsCaptured: true,
        enrichedAt: index >= 4 ? null : now,
      },
    });
  const receivedTimes = [clickTimes[0], clickTimes[1], clickTimes[2], now];
  for (const [index, receivedAt] of receivedTimes.entries())
    await prisma.routeVerityConversion.create({
      data: {
        id: conversionIds[index],
        projectId,
        campaignId,
        goalId,
        clickId: clickIds[index === 3 ? 0 : index],
        event: "purchase",
        orderId: `${nonce}-${index}`,
        orderHash: fingerprint(`${nonce}-${index}`),
        revenue: "1.000",
        currency: "GBP",
        metadata: {},
        occurredAt: clickTimes[0],
        receivedAt,
        payloadHash: fingerprint(`payload-${nonce}-${index}`),
        attributionPolicy: "direct-click-30d-v1",
      },
    });
  for (let index = 0; index < 3; index++)
    await prisma.routeVerityConversionReceipt.create({
      data: {
        id: `cvr_${randomUUID()}`,
        projectId,
        conversionId: conversionIds[0],
        keyHash: fingerprint(`retry-${nonce}-${index}`),
        payloadHash: fingerprint(`payload-${nonce}-0`),
      },
    });
  for (const [index, createdAt] of [
    new Date(cutoff.operator.getTime() - 1),
    cutoff.operator,
    new Date(cutoff.operator.getTime() + 1),
  ].entries())
    await prisma.routeVerityOperatorEvent.create({
      data: {
        id: operatorIds[index],
        projectId,
        actorId: users[0],
        operation: "WORKSPACE_SUSPENDED",
        reason: "Isolated retention fixture",
        wasDisabled: false,
        isDisabled: true,
        createdAt,
      },
    });
});

test.afterAll(async () => {
  if (validated) {
    await prisma.routeVerityConversionReceipt.deleteMany({
      where: { projectId },
    });
    await prisma.routeVerityConversion.deleteMany({ where: { projectId } });
    await prisma.routeVerityConversionKey.deleteMany({ where: { projectId } });
    await prisma.routeVerityConversionGoal.deleteMany({ where: { projectId } });
    await prisma.routeVerityRedirectAudit.deleteMany({ where: { projectId } });
    await prisma.routeVerityOperatorEvent.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  }
  await prisma.$disconnect();
  await workerDatabase.$disconnect();
});

test("real SQL expiry respects exact boundaries, bounded receipts, raw input and operator evidence", async () => {
  const preview = await pruneWorkspaceBatch(projectId, now);
  expect(preview).toMatchObject({
    applied: false,
    clicks: 1,
    conversions: 1,
    receipts: 3,
  });
  expect(
    await prisma.routeVerityConversion.count({ where: { projectId } }),
  ).toBe(4);
  expect(
    await prisma.routeVerityConversionReceipt.count({ where: { projectId } }),
  ).toBe(3);
  const first = await pruneWorkspaceBatch(projectId, now, true, 2);
  expect(first).toMatchObject({
    clicks: 1,
    receipts: 2,
    conversions: 0,
    remainingReceipts: true,
  });
  expect(
    await prisma.routeVerityConversion.findUnique({
      where: { id: conversionIds[0] },
    }),
  ).not.toBeNull();
  const second = await pruneWorkspaceBatch(projectId, now, true, 2);
  expect(second).toMatchObject({
    clicks: 0,
    receipts: 1,
    conversions: 1,
    remainingReceipts: false,
  });
  expect(
    await prisma.routeVerityRedirectAudit.findUnique({
      where: { clickId: clickIds[0] },
    }),
  ).toBeNull();
  expect(
    await prisma.routeVerityConversionReceipt.count({ where: { projectId } }),
  ).toBe(0);
  for (const index of [1, 2]) {
    expect(
      await prisma.routeVerityRedirectAudit.findUnique({
        where: { clickId: clickIds[index] },
      }),
    ).not.toBeNull();
    expect(
      await prisma.routeVerityConversion.findUnique({
        where: { id: conversionIds[index] },
      }),
    ).not.toBeNull();
  }
  expect(await pruneWorkspaceBatch(projectId, now, true)).toMatchObject({
    clicks: 0,
    conversions: 0,
    receipts: 0,
  });
  const globalPreview = await pruneGlobalBatch(now, false, 100, projectId);
  expect(globalPreview).toMatchObject({
    rawUserAgents: 1,
    operatorEvents: 1,
    applied: false,
  });
  expect(
    (
      await prisma.routeVerityRedirectAudit.findUniqueOrThrow({
        where: { clickId: clickIds[4] },
      })
    ).rawUserAgent,
  ).not.toBeNull();
  expect(await pruneGlobalBatch(now, true, 100, projectId)).toMatchObject({
    rawUserAgents: 1,
    operatorEvents: 1,
  });
  expect(
    (
      await prisma.routeVerityRedirectAudit.findUniqueOrThrow({
        where: { clickId: clickIds[4] },
      })
    ).rawUserAgent,
  ).toBeNull();
  expect(
    (
      await prisma.routeVerityRedirectAudit.findUniqueOrThrow({
        where: { clickId: clickIds[5] },
      })
    ).rawUserAgent,
  ).not.toBeNull();
  expect(
    await prisma.routeVerityOperatorEvent.findUnique({
      where: { id: operatorIds[0] },
    }),
  ).toBeNull();
  for (const id of operatorIds.slice(1))
    expect(
      await prisma.routeVerityOperatorEvent.findUnique({ where: { id } }),
    ).not.toBeNull();
});

test("owner settings require confirmation and reject stale forms; viewer and foreign account cannot change retention", async ({
  page,
  browser,
}) => {
  await signInWithEmail(page, ownerEmail);
  await page.goto(`/app/${nonce}/settings`);
  await expect(page.getByLabel("Detailed record retention")).toHaveValue("90");
  await page.getByLabel("Detailed record retention").selectOption("60");
  await page
    .getByRole("button", { name: "Save retention", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Confirm that shorter retention" }),
  ).toBeVisible();
  expect(
    (await prisma.project.findUniqueOrThrow({ where: { id: projectId } }))
      .routeverityRetentionDays,
  ).toBe(90);
  await expect(page.getByLabel("Detailed record retention")).toHaveValue("60");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Save retention", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Retention saved");
  await page.goto(`/app/${nonce}/settings`);
  await expect(page.getByLabel("Detailed record retention")).toHaveValue("60");
  await prisma.project.update({
    where: { id: projectId },
    data: { routeverityRetentionDays: 90 },
  });
  await page.getByLabel("Detailed record retention").selectOption("30");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Save retention", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Retention changed" }),
  ).toContainText("Refresh");
  expect(
    (await prisma.project.findUniqueOrThrow({ where: { id: projectId } }))
      .routeverityRetentionDays,
  ).toBe(90);
  await page.goto(`/app/${nonce}/settings`);
  await page.getByLabel("Detailed record retention").selectOption("60");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Save retention", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Retention saved");
  let result;
  do {
    result = await pruneWorkspaceBatch(projectId, now, true, 2);
  } while (
    result.scannedClicks === 2 ||
    result.scannedConversions === 2 ||
    result.remainingReceipts
  );
  expect(
    await prisma.routeVerityRedirectAudit.count({ where: { projectId } }),
  ).toBe(2);
  expect(
    await prisma.routeVerityConversion.count({ where: { projectId } }),
  ).toBe(1);
  expect(
    await prisma.routeVerityConversion.findUnique({
      where: { id: conversionIds[3] },
    }),
  ).not.toBeNull();
  expect(
    await prisma.routeVerityConversionKey.count({ where: { projectId } }),
  ).toBe(1);
  expect(
    await prisma.routeVerityConversionGoal.count({ where: { projectId } }),
  ).toBe(1);
  expect(await prisma.routeVerityCampaign.count({ where: { projectId } })).toBe(
    1,
  );
  const filters = new URLSearchParams({
    from: cutoff.records.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  });
  const csvResponse = await page.request.get(
    `/app/${nonce}/analytics/export?${filters}`,
  );
  expect(csvResponse.status()).toBe(200);
  const csv = await csvResponse.text();
  for (const id of clickIds.slice(0, 4)) expect(csv).not.toContain(id);
  for (const id of clickIds.slice(4)) expect(csv).toContain(id);
  expect(
    (await page.request.get(`/app/${nonce}/analytics/${clickIds[0]}`)).status(),
  ).toBe(404);
  await page.goto(`/app/${nonce}`);
  await expect(page.getByTestId("overview-conversions")).toHaveText("1");
  await expect(page.getByTestId("overview-revenue-GBP")).toHaveText(
    "GBP 1.000 / 0.000",
  );
  await expect(
    page
      .getByRole("heading", { name: "Clicks with a conversion", exact: true })
      .locator(".."),
  ).toContainText("0.00%");
  const context = await browser.newContext();
  try {
    const viewer = await context.newPage();
    await signInWithEmail(viewer, viewerEmail);
    await viewer.goto(`/app/${nonce}/settings`);
    await expect(
      viewer.getByRole("heading", { name: "Data retention", exact: true }),
    ).toBeVisible();
    await expect(
      viewer.getByRole("button", { name: "Save retention", exact: true }),
    ).toHaveCount(0);
    await context.clearCookies();
    await signInWithEmail(viewer, foreignEmail);
    await viewer.goto(`/app/${nonce}/settings`);
    await expect(viewer).toHaveURL(/\/app$/);
  } finally {
    await context.close();
  }
});
