import { issueConversionKey } from "@/lib/routeverity/conversion-policy";
import {
  expandGoogleAdsTemplate,
  googleAdsPreviewValues,
} from "@/lib/routeverity/google-ads-policy";
import {
  captureMerchantGclid,
  resolveMerchantCandidate,
} from "@/lib/routeverity/merchant-attribution";
import {
  fingerprint,
  issueTrackingToken,
} from "@/lib/routeverity/transparent-policy";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { assertLocalDatabase, signInWithEmail } from "./helpers";

const prisma = new PrismaClient();
const nonce = `conversion-e2e-${Date.now()}`;
const projectId = `ws_${nonce}`;
const campaignId = `cmp_${nonce}`;
const domainId = `dom_${nonce}`;
const host = `${nonce}.example.test`;
const email = `${nonce}@routeverity.test`;
const destination =
  "https://shop.example.com/order?keep=a+b&repeat=2&repeat=1#receipt";
const tracking = issueTrackingToken();
let key = issueConversionKey();
let validated = false;
const url = `/app/${nonce}/conversions`;
const purchase = () => ({
  event: "purchase",
  currency: "GBP",
  order_id: `ORDER-${randomUUID()}`,
  revenue: "0.10",
});
async function post(
  request: APIRequestContext,
  payload: Record<string, string>,
  idempotency = randomUUID(),
  token = key.token,
) {
  return request.post("/api/v1/conversions", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotency,
    },
    data: payload,
  });
}
async function click(request: APIRequestContext) {
  const response = await request.get(
    `/click?${new URLSearchParams({ url: destination, rv_campaign: campaignId, rv_token: tracking.token })}`,
    { headers: { Host: host }, maxRedirects: 0 },
  );
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
  return response.headers()["x-routeverity-click-id"];
}
async function cleanConversions() {
  await prisma.routeVerityConversionReceipt.deleteMany({
    where: { projectId },
  });
  await prisma.routeVerityConversion.deleteMany({ where: { projectId } });
  await prisma.routeVerityConversionGoal.deleteMany({ where: { projectId } });
  await prisma.routeVerityConversionKey.deleteMany({ where: { projectId } });
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
      name: "Conversion acceptance",
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
});

test("Google-style UI template -> exact redirect -> real analytics -> attributed conversion and revenue", async ({
  page,
  request,
}) => {
  await signInWithEmail(page, email);
  await page.goto(`/app/${nonce}/campaigns/${campaignId}`);
  await page
    .getByLabel("Google setup tracking credential", { exact: true })
    .fill(tracking.token);
  await page
    .getByLabel("Sample Google final URL", { exact: true })
    .fill(destination);
  await page
    .getByRole("button", {
      name: "Generate Google Ads template",
      exact: true,
    })
    .click();
  const templateField = page.getByRole("textbox", {
    name: "Google Ads tracking template",
    exact: true,
  });
  await expect(templateField).toBeVisible();
  const template = await templateField.inputValue();
  expect(template).toContain(`https://${host}/click?url={escapedlpurl}`);
  expect(template).toContain("campaignid={campaignid}");
  expect(template).not.toContain("%7B");
  const expanded = new URL(expandGoogleAdsTemplate(template, destination));
  expanded.searchParams.set("gbraid", "local_private_app_braid");
  expanded.searchParams.set("wbraid", "local_private_web_braid");
  const response = await request.get(`${expanded.pathname}${expanded.search}`, {
    headers: { Host: host },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
  const clickId = response.headers()["x-routeverity-click-id"];
  const audit = await prisma.routeVerityRedirectAudit.findUniqueOrThrow({
    where: { clickId },
  });
  expect(audit.validatedNextHopHash).toBe(fingerprint(destination));
  expect(audit.actualRedirectTargetHash).toBe(audit.validatedNextHopHash);
  expect(audit.googleAds).toMatchObject({
    gclidHash: fingerprint(googleAdsPreviewValues.gclid),
    gbraidHash: fingerprint("local_private_app_braid"),
    wbraidHash: fingerprint("local_private_web_braid"),
    campaignid: googleAdsPreviewValues.campaignid,
  });
  expect(JSON.stringify(audit)).not.toContain("local_private_app_braid");
  await page
    .getByRole("combobox", { name: "Final URL insertion", exact: true })
    .selectOption("lpurl");
  await page
    .getByRole("button", { name: "Generate Google Ads template", exact: true })
    .click();
  await expect(templateField).toHaveValue(/url=\{lpurl\}/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel("Sample Google final URL", { exact: true })
    .fill("https://evil.org/");
  await page
    .getByRole("button", { name: "Generate Google Ads template", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "not approved" }),
  ).toBeVisible();
  await expect(templateField).toHaveCount(0);
  await page.goto(`/app/${nonce}/analytics`);
  await expect(page.getByTestId("click-total")).toHaveText("1");
  await page.goto(`/app/${nonce}/analytics/${clickId}`);
  await expect(
    page.getByRole("heading", { name: "Google Ads supplied metadata" }),
  ).toBeVisible();
  expect(await page.locator("main").textContent()).toContain(
    fingerprint(googleAdsPreviewValues.gclid),
  );
  expect(await page.locator("main").textContent()).not.toContain(
    googleAdsPreviewValues.gclid,
  );
  const accepted = await post(request, {
    ...purchase(),
    revenue: "99.99",
    click_id: clickId,
  });
  expect(accepted.status()).toBe(201);
  const conversionId = (await accepted.json()).conversion_id;
  const conversion = await prisma.routeVerityConversion.findUniqueOrThrow({
    where: { id: conversionId },
  });
  expect(conversion.clickId).toBe(clickId);
  expect(conversion.campaignId).toBe(campaignId);
  await page.goto(`/app/${nonce}`);
  await expect(page.getByTestId("overview-conversions")).toHaveText("1");
  await expect(page.getByTestId("overview-revenue-GBP")).toHaveText(
    "GBP 99.990 / 99.990",
  );
  await page.goto(`/app/${nonce}/campaigns/${campaignId}`);
  await page
    .getByLabel("Google setup tracking credential", { exact: true })
    .fill(tracking.token);
  await page
    .getByLabel("Sample Google final URL", { exact: true })
    .fill("https://evil.org/");
  await page
    .getByRole("button", {
      name: "Generate Google Ads template",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "not approved" }),
  ).toBeVisible();
  await expect(templateField).toHaveCount(0);
});

test("independent merchant landing -> shared hash candidate -> conversion without tracker header access", async ({
  request,
}) => {
  const gclid = `merchant_fixture_${randomUUID()}`;
  const landing = new URL(destination);
  landing.searchParams.set("gclid", gclid);
  const merchant = createServer((req, res) => {
    const observed = new URL(req.url ?? "/", "http://127.0.0.1");
    res.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(JSON.stringify(captureMerchantGclid(observed.search, "granted")));
  });
  merchant.listen(0, "127.0.0.1");
  await once(merchant, "listening");
  try {
    const address = merchant.address();
    expect(address && typeof address === "object").toBeTruthy();
    if (!address || typeof address === "string")
      throw new Error("Merchant fixture did not bind a local TCP port");
    const merchantResponse = await request.get(
      `http://127.0.0.1:${address.port}${landing.pathname}${landing.search}`,
    );
    expect(merchantResponse.status()).toBe(200);
    const captured: unknown = await merchantResponse.json();
    expect(captured).toEqual({
      status: "READY",
      gclidHash: fingerprint(gclid),
    });
    if (
      !captured ||
      typeof captured !== "object" ||
      !("gclidHash" in captured) ||
      typeof captured.gclidHash !== "string"
    )
      throw new Error("Merchant fixture did not return valid capture evidence");
    const gclidHash = captured.gclidHash;
    const resolveAt = (occurredAt: Date) =>
      resolveMerchantCandidate({
        projectId,
        campaignId,
        gclidHash,
        occurredAt,
      });
    const beforeTracking = new Date();
    expect(await resolveAt(beforeTracking)).toEqual({
      status: "NO_RECORDED_MATCH",
    });

    const trackingQuery = new URLSearchParams({
      url: destination,
      rv_campaign: campaignId,
      rv_token: tracking.token,
      gclid,
    });
    const background = await request.get(`/click?${trackingQuery}`, {
      headers: { Host: host },
      maxRedirects: 0,
    });
    expect(background.status()).toBe(302);
    expect(background.headers().location).toBe(destination);
    const occurredAt = new Date();
    const candidate = await resolveAt(occurredAt);
    expect(candidate.status).toBe("MATCHED_RECORDED_REQUEST");
    if (candidate.status !== "MATCHED_RECORDED_REQUEST")
      throw new Error(
        `Merchant fixture could not resolve: ${candidate.status}`,
      );
    const audit = await prisma.routeVerityRedirectAudit.findUniqueOrThrow({
      where: { clickId: candidate.clickId },
    });
    expect(audit.googleAds).toEqual({ gclidHash });
    expect(JSON.stringify(audit)).not.toContain(gclid);
    await expect(
      resolveMerchantCandidate({
        projectId: `${projectId}-other`,
        campaignId,
        gclidHash,
        occurredAt,
      }),
    ).rejects.toMatchObject({ code: "WORKSPACE_UNAVAILABLE" });
    expect(
      await resolveMerchantCandidate({
        projectId,
        campaignId: `${campaignId}-other`,
        gclidHash,
        occurredAt,
      }),
    ).toEqual({ status: "NO_RECORDED_MATCH" });
    expect(await resolveAt(new Date(audit.timestamp.getTime() - 1))).toEqual({
      status: "NO_RECORDED_MATCH",
    });
    const payload = {
      ...purchase(),
      click_id: candidate.clickId,
      revenue: "23.45",
      timestamp: occurredAt.toISOString(),
    };
    const idempotency = randomUUID();
    const accepted = await post(request, payload, idempotency);
    expect(accepted.status()).toBe(201);
    const retry = await post(request, payload, idempotency);
    expect(retry.status()).toBe(200);
    expect((await accepted.json()).conversion_id).toBe(
      (await retry.json()).conversion_id,
    );
    const stored = await prisma.routeVerityConversion.findMany({
      where: { projectId, campaignId, clickId: candidate.clickId },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].revenue.toFixed(3)).toBe("23.450");
    expect(stored[0].orderId).toBe(payload.order_id);

    const boundary = new Date(occurredAt.getTime() - 30 * 86400000);
    await prisma.routeVerityRedirectAudit.update({
      where: { clickId: candidate.clickId },
      data: { timestamp: boundary },
    });
    expect((await resolveAt(occurredAt)).status).toBe(
      "MATCHED_RECORDED_REQUEST",
    );
    await prisma.routeVerityRedirectAudit.update({
      where: { clickId: candidate.clickId },
      data: { timestamp: new Date(boundary.getTime() - 1) },
    });
    expect(await resolveAt(occurredAt)).toEqual({
      status: "NO_RECORDED_MATCH",
    });
    await prisma.routeVerityRedirectAudit.update({
      where: { clickId: candidate.clickId },
      data: { timestamp: audit.timestamp },
    });

    const repeated = await request.get(`/click?${trackingQuery}`, {
      headers: { Host: host },
      maxRedirects: 0,
    });
    expect(repeated.status()).toBe(302);
    expect(await resolveAt(new Date())).toEqual({
      status: "AMBIGUOUS_IDENTIFIER",
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      merchant.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
test.beforeEach(async () => {
  await cleanConversions();
  await prisma.routeVerityRedirectAudit.deleteMany({ where: { projectId } });
  await prisma.project.update({
    where: { id: projectId },
    data: { disabledAt: null },
  });
  await prisma.projectUsers.updateMany({
    where: { projectId },
    data: { role: "owner" },
  });
  await prisma.routeVerityCampaign.upsert({
    where: { id: campaignId },
    update: { status: "ACTIVE", trackingTokenHash: tracking.hash },
    create: {
      id: campaignId,
      projectId,
      name: "Conversion campaign",
      advertiser: "Local conversion acceptance",
      trackingParameters: {},
      status: "ACTIVE",
      trackingDomainId: domainId,
      trackingTokenHash: tracking.hash,
      trackingTokenIssuedAt: new Date(),
      destinationDomains: { create: { hostname: "shop.example.com" } },
    },
  });
  for (const [event, currency] of [
    ["purchase", "GBP"],
    ["deposit", "EUR"],
  ]) {
    await prisma.routeVerityConversionGoal.create({
      data: {
        id: `cvg_${randomUUID()}`,
        projectId,
        campaignId,
        name: event,
        event,
        currency,
      },
    });
  }
  key = issueConversionKey();
  await prisma.routeVerityConversionKey.create({
    data: {
      id: key.id,
      projectId,
      name: "Fixture server",
      tokenHash: key.hash,
    },
  });
});
test.afterAll(async () => {
  if (validated) {
    await cleanConversions();
    await prisma.routeVerityRedirectAudit.deleteMany({ where: { projectId } });
    await prisma.routeVerityDestinationDomain.deleteMany({
      where: { campaignId },
    });
    await prisma.routeVerityCampaign.deleteMany({
      where: { id: campaignId, projectId },
    });
    await prisma.domain.deleteMany({ where: { id: domainId, projectId } });
    await prisma.projectUsers.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    const owner = await prisma.user.findUnique({ where: { email } });
    if (owner) {
      await prisma.session.deleteMany({ where: { userId: owner.id } });
      await prisma.user.delete({ where: { id: owner.id } });
    }
  }
  await prisma.$disconnect();
});

test("real UI goals and hashed keys, concurrent dedupe, exact revenue, attributed details and read-only reporting", async ({
  page,
  request,
}) => {
  await signInWithEmail(page, email);
  await page.goto(url);
  await page.getByLabel("Goal name", { exact: true }).fill("Checkout purchase");
  await page.getByLabel("Goal event", { exact: true }).fill("checkout");
  await page
    .getByRole("button", { name: "Create conversion goal", exact: true })
    .click();
  await expect(page.getByText(/Conversion goal created/)).toBeVisible();
  await page.getByLabel("Key label", { exact: true }).fill("UI merchant");
  await page
    .getByLabel(
      "I confirm this key permits server-to-server conversion creation",
    )
    .check();
  await page
    .getByRole("button", { name: "Issue conversion API key", exact: true })
    .click();
  const token = await page
    .getByLabel("New conversion API key (shown once)")
    .inputValue();
  expect(token).toMatch(/^rvcv_/);
  expect(
    await prisma.routeVerityConversionKey.findUnique({
      where: { tokenHash: fingerprint(token) },
    }),
  ).not.toBeNull();
  const clickId = await click(request);
  const payload = {
    ...purchase(),
    event: "checkout",
    click_id: clickId,
    revenue: "10.25",
  };
  const responses = await Promise.all(
    Array.from({ length: 8 }, () =>
      post(request, payload, "concurrent-order", token),
    ),
  );
  expect(responses.map((response) => response.status()).sort()).toEqual([
    200, 200, 200, 200, 200, 200, 200, 201,
  ]);
  const ids = await Promise.all(
    responses.map(async (response) => (await response.json()).conversion_id),
  );
  expect(new Set(ids).size).toBe(1);
  expect(
    (
      await post(
        request,
        { ...payload, revenue: "10.26" },
        "concurrent-order",
        token,
      )
    ).status(),
  ).toBe(409);
  expect((await post(request, payload, "alias-order", token)).status()).toBe(
    200,
  );
  expect(
    (
      await post(
        request,
        { ...payload, revenue: "10.26" },
        "changed-order",
        token,
      )
    ).status(),
  ).toBe(409);
  expect(
    (await post(request, { ...purchase(), click_id: clickId })).status(),
  ).toBe(201);
  expect(
    (
      await post(request, {
        ...purchase(),
        click_id: clickId,
        event: "deposit",
        currency: "EUR",
        revenue: "1.20",
      })
    ).status(),
  ).toBe(201);
  await page.reload();
  await expect(page.getByTestId("conversion-total")).toHaveText("3");
  await expect(page.getByTestId("revenue-GBP")).toHaveText("GBP 10.350");
  await expect(page.getByTestId("revenue-EUR")).toHaveText("EUR 1.200");
  await page.goto(`/app/${nonce}`);
  await expect(page.getByTestId("overview-conversions")).toHaveText("3");
  await expect(page.getByTestId("overview-revenue-GBP")).toHaveText(
    "GBP 10.350 / 10.350",
  );
  await page.goto(`${url}/${ids[0]}`);
  await expect(
    page.getByRole("heading", { name: "Conversion detail" }),
  ).toBeVisible();
  await expect(page.getByText("GBP 10.250", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: `Attributed click: ${clickId}` })
    .click();
  await expect(
    page.getByRole("link", { name: /checkout \/ GBP 10.250/ }),
  ).toBeVisible();
  await prisma.projectUsers.updateMany({
    where: { projectId },
    data: { role: "viewer" },
  });
  await page.goto(url);
  await expect(page.getByTestId("conversion-total")).toHaveText("3");
  await expect(
    page.getByRole("button", { name: "Issue conversion API key" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Goal name")).toHaveCount(0);
  await page.goto(`${url}/cnv_foreign`);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.goto(url);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("header-only GET, goal disabling, exact occurrence window, tenant boundaries and deleted campaign attribution", async ({
  request,
}) => {
  const clickId = await click(request);
  const record = await prisma.routeVerityRedirectAudit.findUniqueOrThrow({
    where: { clickId },
  });
  const clickTime = new Date(Date.now() - 31 * 86400000);
  await prisma.routeVerityRedirectAudit.update({
    where: { clickId },
    data: { timestamp: clickTime },
  });
  const payload = {
    ...purchase(),
    click_id: clickId,
    timestamp: new Date(clickTime.getTime() + 30 * 86400000).toISOString(),
  };
  const query = new URLSearchParams({
    ...payload,
    idempotency_key: "get-postback",
  });
  const response = await request.get(`/conversion?${query}`, {
    headers: { Authorization: `Bearer ${key.token}` },
  });
  expect(response.status()).toBe(201);
  expect(
    (await request.get(`/conversion?${query}&api_key=${key.token}`)).status(),
  ).toBe(401);
  expect(
    (
      await request.get(`/conversion?${query}&event=purchase`, {
        headers: { Authorization: `Bearer ${key.token}` },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(request, {
        ...payload,
        order_id: "expired",
        timestamp: new Date(
          clickTime.getTime() + 30 * 86400000 + 1,
        ).toISOString(),
      })
    ).status(),
  ).toBe(422);
  await prisma.routeVerityConversionGoal.updateMany({
    where: { projectId, event: "purchase" },
    data: { enabled: false },
  });
  expect((await post(request, payload, "new-alias")).status()).toBe(200);
  expect(
    (await post(request, { ...payload, order_id: "disabled-goal" })).status(),
  ).toBe(403);
  await prisma.routeVerityConversionGoal.updateMany({
    where: { projectId },
    data: { enabled: true },
  });
  const foreignClickId = `rvc_${randomUUID()}`;
  await prisma.routeVerityRedirectAudit.create({
    data: {
      ...record,
      googleAds: record.googleAds ?? Prisma.DbNull,
      projectId: `ws_foreign_${nonce}`,
      clickId: foreignClickId,
      requestId: `req_${randomUUID()}`,
    },
  });
  try {
    expect(
      (
        await post(request, { ...purchase(), click_id: foreignClickId })
      ).status(),
    ).toBe(404);
  } finally {
    await prisma.routeVerityRedirectAudit.deleteMany({
      where: { clickId: foreignClickId, projectId: `ws_foreign_${nonce}` },
    });
  }
  await prisma.routeVerityCampaign.update({
    where: { id: campaignId },
    data: { status: "ARCHIVED" },
  });
  expect(
    (await post(request, { ...payload, order_id: "archived-order" })).status(),
  ).toBe(201);
  await prisma.routeVerityDestinationDomain.deleteMany({
    where: { campaignId },
  });
  await prisma.routeVerityCampaign.delete({ where: { id: campaignId } });
  expect(
    (await post(request, { ...payload, order_id: "deleted-order" })).status(),
  ).toBe(201);
  await prisma.project.update({
    where: { id: projectId },
    data: { disabledAt: new Date() },
  });
  expect((await post(request, payload, "get-postback")).status()).toBe(403);
});

test("five-key boundary, UI revocation and tracking secrets cannot ingest conversions", async ({
  page,
  request,
}) => {
  const clickId = await click(request);
  for (let index = 0; index < 4; index++) {
    const another = issueConversionKey();
    await prisma.routeVerityConversionKey.create({
      data: {
        id: another.id,
        projectId,
        name: `Extra ${index}`,
        tokenHash: another.hash,
      },
    });
  }
  await signInWithEmail(page, email);
  await page.goto(url);
  await page.getByLabel("Key label", { exact: true }).fill("Sixth key");
  await page
    .getByLabel(
      "I confirm this key permits server-to-server conversion creation",
    )
    .check();
  await page
    .getByRole("button", { name: "Issue conversion API key", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "At most five" }),
  ).toBeVisible();
  await page
    .getByLabel("Confirm permanent revocation of Fixture server")
    .check();
  await page
    .getByRole("button", { name: "Revoke Fixture server", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Revoke Fixture server", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await prisma.routeVerityConversionKey.findUniqueOrThrow({
        where: { id: key.id },
      })
    ).revokedAt,
  ).not.toBeNull();
  expect(
    (await post(request, { ...purchase(), click_id: clickId })).status(),
  ).toBe(401);
  expect(
    (
      await post(
        request,
        { ...purchase(), click_id: clickId },
        "tracking-secret",
        tracking.token,
      )
    ).status(),
  ).toBe(401);
  await page.getByLabel("Key label", { exact: true }).fill("Replacement");
  await page
    .getByLabel(
      "I confirm this key permits server-to-server conversion creation",
    )
    .check();
  await page
    .getByRole("button", { name: "Issue conversion API key", exact: true })
    .click();
  await expect(
    page.getByLabel("New conversion API key (shown once)"),
  ).toBeVisible();
  expect(
    await prisma.routeVerityConversionKey.count({
      where: { projectId, revokedAt: null },
    }),
  ).toBe(5);
});

test("case-sensitive order dedupe, exact decimal sums, UTC paging and filters", async ({
  page,
  request,
}) => {
  const clickId = await click(request);
  for (const order_id of ["Order-A", "order-a"])
    expect(
      (
        await post(request, { ...purchase(), click_id: clickId, order_id })
      ).status(),
    ).toBe(201);
  const goal = await prisma.routeVerityConversionGoal.findFirstOrThrow({
    where: { projectId, event: "purchase" },
  });
  const day = new Date().toISOString().slice(0, 10);
  const daily = new Date(`${day}T00:00:00Z`);
  await prisma.routeVerityConversion.createMany({
    data: Array.from({ length: 49 }, (_, index) => ({
      id: `cnv_${randomUUID()}`,
      projectId,
      campaignId,
      goalId: goal.id,
      clickId,
      event: goal.event,
      orderId: `paging-${index}`,
      orderHash: fingerprint(`paging-${index}`),
      revenue: "0.100",
      currency: "GBP",
      occurredAt: daily,
      metadata: {},
      payloadHash: fingerprint(`paging-${index}`),
      attributionPolicy: "paging-fixture",
    })),
  });
  await signInWithEmail(page, email);
  await page.goto(`${url}?from=${day}&to=${day}`);
  await expect(page.getByTestId("conversion-total")).toHaveText("51");
  await expect(page.getByTestId("revenue-GBP")).toHaveText("GBP 5.100");
  await expect(
    page.getByRole("link", { name: "purchase", exact: true }),
  ).toHaveCount(50);
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "purchase", exact: true }),
  ).toHaveCount(1);
  await page.goto(`${url}?campaign=cmp_foreign`);
  await expect(page.getByTestId("conversion-total")).toHaveText("0");
  await page.goto(`${url}?goal=foreign_goal`);
  await expect(page.getByTestId("conversion-total")).toHaveText("0");
  await page.goto(`${url}?from=2026-02-30`);
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid analytics filters" }),
  ).toBeVisible();
});
