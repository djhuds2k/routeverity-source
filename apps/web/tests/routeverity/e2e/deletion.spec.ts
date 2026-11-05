import {
  fingerprint,
  issueTrackingToken,
} from "@/lib/routeverity/transparent-policy";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertLocalDatabase, signInWithEmail } from "./helpers";

const prisma = new PrismaClient();
test.describe.configure({ mode: "serial" });
const nonce = `deletion-${Date.now()}-${randomUUID().slice(0, 8)}`;
const ownerEmail = `${nonce}-owner@routeverity.test`;
const otherEmail = `${nonce}-other@routeverity.test`;
const projectId = `ws_${nonce}`;
const sharedId = `ws_${nonce}-shared`;
const campaignId = `cmp_${nonce}`;
const tracking = issueTrackingToken();
const host = `${nonce}.example.test`;
const clickId = `rvc_${randomUUID()}`;
const conversionId = `cnv_${randomUUID()}`;
const goalId = `goal_${nonce}`;
const auditId = `audit_${randomUUID()}`;
const keyHash = fingerprint(`key-${nonce}`);
const users: string[] = [];
let validated = false;

test.beforeAll(async () => {
  assertLocalDatabase();
  const smtp = new URL(process.env.EMAIL_SERVER ?? "");
  expect(["localhost", "127.0.0.1"]).toContain(smtp.hostname);
  expect(smtp.port).toBe("11025");
  validated = true;
  for (const email of [ownerEmail, otherEmail]) {
    const user = await prisma.user.create({
      data: { email, emailVerified: new Date() },
    });
    users.push(user.id);
  }
  await prisma.project.create({
    data: {
      id: projectId,
      slug: nonce,
      name: "Deletion acceptance",
      billingCycleStart: 1,
      users: {
        create: [
          { userId: users[0], role: "owner" },
          { userId: users[1], role: "viewer" },
        ],
      },
      domains: {
        create: [
          { slug: `${nonce}.localhost`, type: "DEVELOPMENT", verified: true },
          { slug: host, type: "TRANSPARENT_TRACKING", verified: true },
        ],
      },
    },
  });
  await prisma.project.create({
    data: {
      id: sharedId,
      slug: `${nonce}-shared`,
      name: "Other member workspace",
      billingCycleStart: 1,
      users: {
        create: [
          { userId: users[1], role: "owner" },
          { userId: users[0], role: "member" },
        ],
      },
      domains: {
        create: {
          slug: `${nonce}-shared.localhost`,
          type: "DEVELOPMENT",
          verified: true,
        },
      },
    },
  });
  const domain = await prisma.domain.findUniqueOrThrow({
    where: { slug: host },
  });
  await prisma.routeVerityCampaign.create({
    data: {
      id: campaignId,
      projectId,
      name: "Delete this campaign",
      advertiser: "Local fixture",
      trackingDomainId: domain.id,
      trackingParameters: {},
      status: "ACTIVE",
      trackingTokenHash: tracking.hash,
      trackingTokenIssuedAt: new Date(),
      destinationDomains: { create: { hostname: "shop.example.com" } },
    },
  });
  for (const [id, slug] of [
    [projectId, nonce],
    [sharedId, `${nonce}-shared`],
  ])
    await prisma.link.create({
      data: {
        id: `link_${id}`,
        projectId: id,
        userId: users[0],
        domain: `${slug}.localhost`,
        key: "keep-or-delete",
        shortLink: `http://localhost:8888/r/${slug}/keep-or-delete`,
        url: "http://localhost:8888/features",
      },
    });
  await prisma.user.updateMany({
    where: { id: { in: users } },
    data: { defaultWorkspace: nonce },
  });
  await prisma.routeVerityRedirectAudit.create({
    data: {
      clickId,
      requestId: randomUUID(),
      projectId,
      campaignId,
      trackingDomain: host,
      destinationHostname: "shop.example.com",
      providedNextHopHash: fingerprint("https://shop.example.com"),
      validatedNextHopHash: fingerprint("https://shop.example.com"),
      actualRedirectTargetHash: fingerprint("https://shop.example.com"),
      validationResult: "ALLOWED",
      redirectStatus: 302,
      processingTimeMs: 1,
      policyVersion: "local-deletion-test",
      appVersion: "local-test",
    },
  });
  await prisma.routeVerityConversionGoal.create({
    data: {
      id: goalId,
      projectId,
      campaignId,
      event: "purchase",
      name: "Purchase",
      currency: "GBP",
    },
  });
  await prisma.routeVerityConversionKey.create({
    data: {
      id: `key_${nonce}`,
      projectId,
      name: "Delete key",
      tokenHash: keyHash,
    },
  });
  await prisma.routeVerityConversion.create({
    data: {
      id: conversionId,
      projectId,
      campaignId,
      goalId,
      clickId,
      event: "purchase",
      orderId: nonce,
      orderHash: fingerprint(nonce),
      revenue: "1.000",
      currency: "GBP",
      occurredAt: new Date(),
      metadata: {},
      payloadHash: fingerprint(`payload-${nonce}`),
      attributionPolicy: "direct-click-30d-v1",
    },
  });
  await prisma.routeVerityConversionReceipt.create({
    data: {
      id: `receipt_${nonce}`,
      projectId,
      conversionId,
      keyHash: fingerprint(`receipt-${nonce}`),
      payloadHash: fingerprint(`payload-${nonce}`),
    },
  });
  await prisma.routeVerityMerchantSubmission.create({
    data: {
      id: `mcv_${nonce}`,
      projectId,
      campaignId,
      goalId,
      credentialId: `key_${nonce}`,
      event: "purchase",
      orderId: `merchant-${nonce}`,
      orderHash: fingerprint(`merchant-${nonce}`),
      revenue: "2.000",
      currency: "GBP",
      occurredAt: new Date(),
      payloadHash: fingerprint(`merchant-payload-${nonce}`),
      status: "PENDING",
      reason: "NO_RECORDED_MATCH",
      gclidHash: fingerprint(`merchant-gclid-${nonce}`),
      reconcileUntil: new Date(Date.now() + 86400000),
      nextAttemptAt: new Date(),
    },
  });
  await prisma.routeVerityMerchantReceipt.create({
    data: {
      id: `mcr_${nonce}`,
      projectId,
      submissionId: `mcv_${nonce}`,
      keyHash: fingerprint(`merchant-receipt-${nonce}`),
      payloadHash: fingerprint(`merchant-payload-${nonce}`),
    },
  });
  await prisma.routeVerityOperatorEvent.create({
    data: {
      id: auditId,
      projectId,
      actorId: users[0],
      operation: "WORKSPACE_SUSPENDED",
      reason: "Isolated local deletion fixture",
      wasDisabled: false,
      isDisabled: true,
    },
  });
});

test.afterAll(async () => {
  if (validated) {
    const where = { projectId: { in: [projectId, sharedId] } };
    await prisma.routeVerityMerchantReceipt.deleteMany({ where });
    await prisma.routeVerityMerchantSubmission.deleteMany({ where });
    await prisma.routeVerityConversionReceipt.deleteMany({ where });
    await prisma.routeVerityConversion.deleteMany({ where });
    await prisma.routeVerityConversionKey.deleteMany({ where });
    await prisma.routeVerityConversionGoal.deleteMany({ where });
    await prisma.routeVerityRedirectAudit.deleteMany({ where });
    await prisma.routeVerityOperatorEvent.deleteMany({ where });
    await prisma.routeVerityCampaign.deleteMany({ where });
    await prisma.link.deleteMany({ where });
    await prisma.domain.deleteMany({ where });
    await prisma.project.deleteMany({
      where: { id: { in: [projectId, sharedId] } },
    });
    for (const email of [ownerEmail, otherEmail]) {
      await prisma.verificationToken.deleteMany({
        where: { identifier: email },
      });
      await prisma.emailVerificationToken.deleteMany({
        where: { identifier: email },
      });
      await prisma.passwordResetToken.deleteMany({
        where: { identifier: email },
      });
    }
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  }
  await prisma.$disconnect();
});

test("owner deletion erases scoped live data, retains operator audit and blocks concurrent late clicks", async ({
  page,
  browser,
}) => {
  await signInWithEmail(page, ownerEmail);
  await page.goto("/account");
  await expect(page.getByRole("status")).toContainText("blocked while you own");
  const context = await browser.newContext();
  try {
    const viewer = await context.newPage();
    await signInWithEmail(viewer, otherEmail);
    await viewer.goto("/account");
    await expect(
      viewer.getByRole("button", {
        name: `Permanently delete ${nonce}`,
        exact: true,
      }),
    ).toHaveCount(0);
    const address = page.getByLabel(`Type workspace address: ${nonce}`, {
      exact: true,
    });
    await address.fill(`${nonce}-wrong`);
    await page
      .getByRole("checkbox", {
        name: "I confirm permanent deletion of this workspace and its data.",
      })
      .check();
    await page
      .getByRole("button", { name: `Permanently delete ${nonce}`, exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "exact workspace address" }),
    ).toBeVisible();
    expect(
      await prisma.project.findUnique({ where: { id: projectId } }),
    ).not.toBeNull();
    await address.fill(nonce);
    await prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date(Date.now() + 1) },
    });
    await page
      .getByRole("button", { name: `Permanently delete ${nonce}`, exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "workspace changed" }),
    ).toBeVisible();
    await page.goto("/account");
    await address.fill(nonce);
    await page
      .getByRole("checkbox", {
        name: "I confirm permanent deletion of this workspace and its data.",
      })
      .check();
    const clickUrl = `/click?${new URLSearchParams({
      url: "https://shop.example.com",
      rv_campaign: campaignId,
      rv_token: tracking.token,
    })}`;
    const beforeDeletion = await page.request.get(clickUrl, {
      headers: { Host: host },
      maxRedirects: 0,
    });
    expect(beforeDeletion.status()).toBe(302);
    expect(beforeDeletion.headers().location).toBe("https://shop.example.com");
    const pendingClicks = Promise.all(
      Array.from({ length: 3 }, () =>
        page.request.get(clickUrl, {
          headers: { Host: host },
          maxRedirects: 0,
        }),
      ),
    );
    await page
      .getByRole("button", { name: `Permanently delete ${nonce}`, exact: true })
      .click();
    await expect(async () => {
      expect(
        await prisma.project.findUnique({ where: { id: projectId } }),
      ).toBeNull();
    }).toPass({ timeout: 10000 });
    for (const response of await pendingClicks) {
      expect([302, 404, 503]).toContain(response.status());
      expect(response.headers().location).toBe(
        response.status() === 302 ? "https://shop.example.com" : undefined,
      );
    }
    const where = { projectId };
    const counts = await Promise.all([
      prisma.routeVerityMerchantReceipt.count({ where }),
      prisma.routeVerityMerchantSubmission.count({ where }),
      prisma.routeVerityConversionReceipt.count({ where }),
      prisma.routeVerityConversion.count({ where }),
      prisma.routeVerityConversionKey.count({ where }),
      prisma.routeVerityConversionGoal.count({ where }),
      prisma.routeVerityRedirectAudit.count({ where }),
      prisma.routeVerityCampaign.count({ where }),
      prisma.link.count({ where }),
      prisma.domain.count({ where }),
      prisma.projectUsers.count({ where }),
    ]);
    expect(counts).toEqual(Array(11).fill(0));
    expect(
      await prisma.routeVerityDestinationDomain.count({
        where: { campaignId },
      }),
    ).toBe(0);
    expect(
      await prisma.routeVerityOperatorEvent.findUnique({
        where: { id: auditId },
      }),
    ).not.toBeNull();
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: users[1] } }))
        .defaultWorkspace,
    ).toBeNull();
    expect(
      (
        await page.request.get(clickUrl, {
          headers: { Host: host },
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.get(`/r/${nonce}/keep-or-delete`, {
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(404);
    await viewer.goto(`/app/${nonce}/settings`);
    await expect(viewer).toHaveURL(/\/app$/);
    expect(
      await prisma.project.findUnique({ where: { id: sharedId } }),
    ).not.toBeNull();
  } finally {
    await context.close();
  }
});

test("account deletion revokes every session/token but preserves shared workspaces and authored links", async ({
  page,
  browser,
}) => {
  await signInWithEmail(page, ownerEmail);
  const context = await browser.newContext();
  try {
    const secondSession = await context.newPage();
    await signInWithEmail(secondSession, ownerEmail);
    expect(
      await prisma.session.count({ where: { userId: users[0] } }),
    ).toBeGreaterThanOrEqual(2);
    const tokenData = () => ({
      identifier: ownerEmail,
      token: `${randomUUID()}-${nonce}`,
      expires: new Date(Date.now() + 60000),
    });
    await prisma.verificationToken.create({ data: tokenData() });
    await prisma.emailVerificationToken.create({ data: tokenData() });
    await prisma.passwordResetToken.create({ data: tokenData() });
    await page.goto("/account");
    await page.getByLabel("Type your email address").fill(otherEmail);
    await page
      .getByRole("checkbox", {
        name: "I confirm permanent account deletion and session revocation.",
      })
      .check();
    await page
      .getByRole("button", {
        name: "Permanently delete my account",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "exact current email" }),
    ).toBeVisible();
    await page.getByLabel("Type your email address").fill(ownerEmail);
    await page
      .getByRole("button", {
        name: "Permanently delete my account",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      await prisma.user.findUnique({ where: { id: users[0] } }),
    ).toBeNull();
    expect(await prisma.session.count({ where: { userId: users[0] } })).toBe(0);
    expect(
      await prisma.projectUsers.count({ where: { userId: users[0] } }),
    ).toBe(0);
    const tokenWhere = { identifier: ownerEmail };
    expect(
      await Promise.all([
        prisma.verificationToken.count({ where: tokenWhere }),
        prisma.emailVerificationToken.count({ where: tokenWhere }),
        prisma.passwordResetToken.count({ where: tokenWhere }),
      ]),
    ).toEqual([0, 0, 0]);
    await secondSession.goto("/app");
    await expect(secondSession).toHaveURL(/\/login$/);
    const sharedLink = await prisma.link.findUniqueOrThrow({
      where: { id: `link_${sharedId}` },
    });
    expect(sharedLink.userId).toBeNull();
    expect(
      (
        await page.request.get(`/r/${nonce}-shared/keep-or-delete`, {
          maxRedirects: 0,
        })
      ).status(),
    ).toBe(302);
    expect(
      await prisma.project.findUnique({ where: { id: sharedId } }),
    ).not.toBeNull();
    const evidence = await prisma.routeVerityOperatorEvent.findUniqueOrThrow({
      where: { id: auditId },
    });
    expect(evidence.actorId).toBe(users[0]);
    expect(evidence.projectId).toBe(projectId);
  } finally {
    await context.close();
  }
});

test("a suspended owned workspace still blocks account deletion and can be erased from account controls", async ({
  page,
}) => {
  await prisma.project.update({
    where: { id: sharedId },
    data: { disabledAt: new Date() },
  });
  await signInWithEmail(page, otherEmail);
  await page.goto("/account");
  await expect(page.getByRole("status")).toContainText("blocked while you own");
  await expect(
    page.getByText("Suspended workspace", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel(`Type workspace address: ${nonce}-shared`, { exact: true })
    .fill(`${nonce}-shared`);
  await page
    .getByRole("checkbox", {
      name: "I confirm permanent deletion of this workspace and its data.",
    })
    .check();
  await page
    .getByRole("button", {
      name: `Permanently delete ${nonce}-shared`,
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Type your email address")).toBeVisible();
  expect(
    await prisma.project.findUnique({ where: { id: sharedId } }),
  ).toBeNull();
});
