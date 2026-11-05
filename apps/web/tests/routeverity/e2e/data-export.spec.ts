import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertLocalDatabase, signInWithEmail } from "./helpers";

const prisma = new PrismaClient();
const nonce = `export-${Date.now()}-${randomUUID().slice(0, 8)}`;
const projectId = `ws_${nonce}`;
const campaignId = `cmp_${nonce}`;
const goalId = `goal_${nonce}`;
const userIds: string[] = [];
const emails = ["owner", "member", "foreign"].map(
  (role) => `${nonce}-${role}@routeverity.test`,
);
const privateTrackingHash = `tracking-${nonce}`.padEnd(64, "x").slice(0, 64);
const privateKeyHash = `key-${nonce}`.padEnd(64, "x").slice(0, 64);
const secretAgent = `private-agent-${nonce}`;
let validated = false;

test.beforeAll(async () => {
  assertLocalDatabase();
  const smtp = new URL(process.env.EMAIL_SERVER ?? "");
  expect(["localhost", "127.0.0.1"]).toContain(smtp.hostname);
  expect(smtp.port).toBe("11025");
  validated = true;
  for (const email of emails) {
    const user = await prisma.user.create({
      data: { email, emailVerified: new Date() },
    });
    userIds.push(user.id);
  }
  await prisma.project.create({
    data: {
      id: projectId,
      slug: nonce,
      name: "Data export fixture",
      billingCycleStart: 1,
      users: {
        create: [
          { userId: userIds[0], role: "owner" },
          { userId: userIds[1], role: "member" },
        ],
      },
      domains: {
        create: {
          slug: `${nonce}.localhost`,
          type: "DEVELOPMENT",
          verified: true,
          verificationToken: `secret-txt-${nonce}`,
        },
      },
    },
  });
  await prisma.routeVerityCampaign.create({
    data: {
      id: campaignId,
      projectId,
      name: "Export campaign",
      advertiser: "Local fixture",
      notes: "Customer-provided notes",
      trackingParameters: {},
      trackingTokenHash: privateTrackingHash,
      destinationDomains: { create: { hostname: "shop.example.com" } },
    },
  });
  await prisma.link.create({
    data: {
      id: `link_${nonce}`,
      userId: userIds[0],
      projectId,
      domain: `${nonce}.localhost`,
      key: "exported",
      shortLink: `http://localhost:8888/r/${nonce}/exported`,
      url: "https://shop.example.com/path",
    },
  });
  const clicks = Array.from({ length: 51 }, (_, index) => ({
    clickId: `rvc_${randomUUID()}`,
    requestId: randomUUID(),
    projectId,
    campaignId: index === 50 ? `deleted_${nonce}` : campaignId,
    trackingDomain: "tracking.example.test",
    destinationHostname: "shop.example.com",
    providedNextHopHash: "a".repeat(64),
    validatedNextHopHash: "a".repeat(64),
    actualRedirectTargetHash: "a".repeat(64),
    validationResult: "ALLOWED",
    redirectStatus: 302,
    processingTimeMs: 1,
    policyVersion: "local-export-test",
    appVersion: "local-test",
    analyticsCaptured: true,
    rawUserAgent: secretAgent,
  }));
  await prisma.routeVerityRedirectAudit.createMany({ data: clicks });
  await prisma.routeVerityConversionGoal.create({
    data: {
      id: goalId,
      projectId,
      campaignId,
      name: "Purchase",
      event: "purchase",
      currency: "KWD",
    },
  });
  await prisma.routeVerityConversionKey.create({
    data: {
      id: `key_${nonce}`,
      projectId,
      name: "Key metadata only",
      tokenHash: privateKeyHash,
    },
  });
  await prisma.routeVerityConversion.create({
    data: {
      id: `cnv_${nonce}`,
      projectId,
      campaignId,
      goalId,
      clickId: clicks[0].clickId,
      event: "purchase",
      orderId: `ORDER-${nonce}`,
      orderHash: "b".repeat(64),
      customerReference: "opaque-customer",
      revenue: "123.456",
      currency: "KWD",
      occurredAt: new Date(),
      metadata: { custom: "customer-supplied" },
      payloadHash: "c".repeat(64),
      attributionPolicy: "direct-click-30d-v1",
    },
  });
  await prisma.routeVerityOperatorEvent.create({
    data: {
      id: `audit_${nonce}`,
      projectId,
      actorId: userIds[0],
      operation: "WORKSPACE_SUSPENDED",
      reason: `private-incident-${nonce}`,
      wasDisabled: false,
      isDisabled: true,
    },
  });
});

test.afterAll(async () => {
  if (validated) {
    const where = { projectId };
    await prisma.routeVerityConversion.deleteMany({ where });
    await prisma.routeVerityConversionGoal.deleteMany({ where });
    await prisma.routeVerityConversionKey.deleteMany({ where });
    await prisma.routeVerityRedirectAudit.deleteMany({ where });
    await prisma.routeVerityOperatorEvent.deleteMany({ where });
    await prisma.routeVerityCampaign.deleteMany({ where });
    await prisma.link.deleteMany({ where });
    await prisma.domain.deleteMany({ where });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.$disconnect();
});

test("owner downloads complete retained scope and own account, excluding credentials; member CSV remains available", async ({
  page,
  browser,
}) => {
  await signInWithEmail(page, emails[0]);
  await page.goto(`/app/${nonce}/settings`);
  const exportPath = `/app/${nonce}/settings/export`;
  const output = await page.request.get(exportPath);
  expect(output.status()).toBe(200);
  expect(output.headers()["content-disposition"]).toBe(
    'attachment; filename="routeverity-workspace.json"',
  );
  expect(output.headers()["cache-control"]).toContain("no-store");
  const data = await output.json();
  expect(data.schemaVersion).toBe("routeverity-export-v1");
  expect(data.scope).toBe("workspace");
  expect(data.workspace.id).toBe(projectId);
  expect(data.clickAudits).toHaveLength(51);
  expect(
    data.clickAudits.some(
      (row: { campaignId: string }) => row.campaignId === `deleted_${nonce}`,
    ),
  ).toBe(true);
  expect(data.conversions[0]).toMatchObject({
    orderId: `ORDER-${nonce}`,
    customerReference: "opaque-customer",
    revenue: "123.456",
    currency: "KWD",
    metadata: { custom: "customer-supplied" },
  });
  expect(data.destinationPolicies[0].hostname).toBe("shop.example.com");
  expect(data.links[0].url).toBe("https://shop.example.com/path");
  expect(data.memberships).toHaveLength(2);
  expect(data.conversionKeyMetadata[0].name).toBe("Key metadata only");
  const serialized = JSON.stringify(data);
  for (const privateValue of [
    privateTrackingHash,
    privateKeyHash,
    secretAgent,
    `secret-txt-${nonce}`,
    `private-incident-${nonce}`,
    emails[1],
  ])
    expect(serialized).not.toContain(privateValue);
  for (const field of [
    "tokenHash",
    "trackingTokenHash",
    "verificationToken",
    "rawUserAgent",
    "sessionToken",
    "passwordHash",
    "payloadHash",
    "orderHash",
  ])
    expect(serialized).not.toContain(`"${field}"`);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download workspace JSON", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("routeverity-workspace.json");
  expect(await download.failure()).toBeNull();
  expect((await page.request.get(`${exportPath}?limit=1`)).status()).toBe(400);
  expect((await page.request.post(exportPath)).status()).toBe(405);
  const accountResponse = await page.request.get("/account/export");
  expect(accountResponse.status()).toBe(200);
  const account = await accountResponse.json();
  expect(account.scope).toBe("account");
  expect(account.user.email).toBe(emails[0]);
  expect(account.authoredLinkReferences).toHaveLength(1);
  expect(account.authoredLinkReferences[0].url).toBeUndefined();
  expect(JSON.stringify(account)).not.toContain(emails[1]);
  for (const session of account.sessions)
    expect(session.sessionToken).toBeUndefined();
  const context = await browser.newContext();
  try {
    const member = await context.newPage();
    await signInWithEmail(member, emails[1]);
    await member.goto(`/app/${nonce}/settings`);
    await expect(
      member.getByRole("link", {
        name: "Download workspace JSON",
        exact: true,
      }),
    ).toHaveCount(0);
    expect((await member.request.get(exportPath)).status()).toBe(403);
    expect(
      (await member.request.get(`/app/${nonce}/analytics/export`)).status(),
    ).toBe(200);
    const personal = await (await member.request.get("/account/export")).json();
    expect(personal.user.email).toBe(emails[1]);
    expect(personal.authoredLinkReferences).toHaveLength(0);
    await context.clearCookies();
    await signInWithEmail(member, emails[2]);
    expect((await member.request.get(exportPath)).status()).toBe(403);
  } finally {
    await context.close();
  }
  await prisma.project.update({
    where: { id: projectId },
    data: { disabledAt: new Date() },
  });
  await page.goto("/account");
  await expect(
    page.getByRole("link", {
      name: `Download ${nonce} workspace JSON`,
      exact: true,
    }),
  ).toBeVisible();
  const suspended = await page.request.get(exportPath);
  expect(suspended.status()).toBe(200);
  expect((await suspended.json()).workspace.disabledAt).not.toBeNull();
  const anonymous = await browser.newContext();
  try {
    const visitor = await anonymous.newPage();
    expect(
      (
        await visitor.request.get("/account/export", { maxRedirects: 0 })
      ).status(),
    ).toBe(307);
    expect(
      (await visitor.request.get(exportPath, { maxRedirects: 0 })).status(),
    ).toBe(307);
  } finally {
    await anonymous.close();
  }
});
