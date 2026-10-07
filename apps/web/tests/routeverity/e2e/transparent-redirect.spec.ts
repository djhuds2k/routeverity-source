import {
  fingerprint,
  issueTrackingToken,
} from "@/lib/routeverity/transparent-policy";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { assertLocalDatabase, signInWithEmail } from "./helpers";

const prisma = new PrismaClient();
const nonce = `click-e2e-${Date.now()}`;
const projectId = `ws_${nonce}`;
const campaignId = `cmp_click_e2e_${Date.now()}`;
const domainId = `dom_${nonce}`;
const host = `${nonce}.example.test`;
const email = `${nonce}@routeverity.test`;
const destination =
  "https://shop.example.com/offer%2fraw?order=2&order=1&keep=a+b&escape=%2520#section%20one";
let credential = issueTrackingToken();
let validatedLocal = false;

function trackingPath(target = destination, token = credential.token) {
  return `/click?${new URLSearchParams({ url: target, rv_campaign: campaignId, rv_token: token })}`;
}
async function click(
  request: APIRequestContext,
  target = destination,
  token = credential.token,
  headers: Record<string, string> = {},
) {
  return request.get(trackingPath(target, token), {
    maxRedirects: 0,
    headers: { Host: host, ...headers },
  });
}
test.beforeAll(async () => {
  assertLocalDatabase();
  validatedLocal = true;
  const owner = await prisma.user.create({
    data: { email, emailVerified: new Date() },
  });
  await prisma.project.create({
    data: {
      id: projectId,
      name: "Transparent redirect acceptance",
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
      routeverityCampaigns: {
        create: {
          id: campaignId,
          name: "Transparent fixture",
          advertiser: "Local acceptance",
          status: "ACTIVE",
          trackingDomainId: domainId,
          trackingParameters: { utm_source: "must-not-be-injected" },
          trackingTokenHash: credential.hash,
          trackingTokenIssuedAt: new Date(),
          destinationDomains: {
            create: { hostname: "example.com", includeSubdomains: true },
          },
        },
      },
    },
  });
});
test.beforeEach(async () => {
  credential = issueTrackingToken();
  await prisma.routeVerityRedirectAudit.deleteMany({ where: { projectId } });
  await prisma.routeVerityCampaign.update({
    where: { id: campaignId },
    data: {
      status: "ACTIVE",
      trackingTokenHash: credential.hash,
      trackingTokenIssuedAt: new Date(),
    },
  });
  await prisma.domain.update({
    where: { id: domainId },
    data: {
      verified: true,
      suspendedAt: null,
      archived: false,
      type: "TRANSPARENT_TRACKING",
    },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { disabledAt: null },
  });
});
test.afterAll(async () => {
  if (validatedLocal) {
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
    const owner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (owner) {
      await prisma.session.deleteMany({ where: { userId: owner.id } });
      await prisma.user.delete({ where: { id: owner.id } });
    }
  }
  await prisma.$disconnect();
});

test("campaign owner can issue, build a transparent test URL, inspect fingerprints and revoke", async ({
  page,
  request,
}) => {
  await signInWithEmail(page, email);
  const campaignUrl = `/app/${nonce}/campaigns/${campaignId}`;
  await page.goto(campaignUrl);
  await page
    .getByLabel("I confirm rotation invalidates previous tracking URLs")
    .check();
  await page
    .getByRole("button", {
      name: "Issue / rotate tracking credential",
      exact: true,
    })
    .click();
  const tokenField = page.getByRole("textbox", {
    name: "New tracking credential (shown once)",
    exact: true,
  });
  await expect(tokenField).toBeVisible();
  const issued = await tokenField.inputValue();
  expect(issued).not.toBe(credential.token);
  expect((await click(request)).status()).toBe(404);
  await page.getByLabel("Test next-hop URL", { exact: true }).fill(destination);
  await page.getByRole("button", { name: "Build test tracking URL" }).click();
  const generated = new URL(
    await page
      .getByRole("textbox", { name: "Test tracking URL", exact: true })
      .inputValue(),
  );
  expect(generated.hostname).toBe(host);
  expect(generated.searchParams.get("url")).toBe(destination);
  expect(generated.searchParams.get("rv_token")).toBe(issued);
  const response = await click(request, destination, issued);
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
  await page
    .getByRole("link", { name: "Inspect redirect integrity audit" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Redirect integrity audit" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Matched HTTP 302", exact: true }),
  ).toBeVisible();
  expect(await page.locator("main").textContent()).not.toContain(issued);
  const audit = await prisma.routeVerityRedirectAudit.findUnique({
    where: { clickId: response.headers()["x-routeverity-click-id"] },
  });
  expect(audit?.providedNextHopHash).toBe(fingerprint(destination));
  expect(audit?.validatedNextHopHash).toBe(audit?.actualRedirectTargetHash);
  expect(audit?.requestId).toBe(response.headers()["x-routeverity-request-id"]);
  expect(JSON.stringify(audit)).not.toContain(destination);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.goto(campaignUrl);
  await expect(tokenField).toHaveCount(0);
  await page.getByLabel("I confirm revocation stops tracking URLs").check();
  await page
    .getByRole("button", { name: "Revoke tracking credential", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Credential revoked" }),
  ).toBeVisible();
  expect((await click(request, destination, issued)).status()).toBe(404);
  expect(
    await prisma.routeVerityRedirectAudit.count({ where: { projectId } }),
  ).toBe(1);
});

test("actual HTTP Location is identical for crawlers, browsers and visitor metadata", async ({
  request,
}) => {
  const variants: Record<string, string>[] = [
    { "User-Agent": "Googlebot", Cookie: "review=1" },
    { "User-Agent": "AdsBot-Google", "X-Forwarded-For": "8.8.8.8" },
    { "User-Agent": "Mobile Safari", "X-Vercel-IP-Country": "GB" },
    {
      "User-Agent": "Firefox",
      Referer: "https://advertiser.example.com/visit",
    },
  ];
  const ids = new Set<string>();
  for (const headers of variants) {
    const response = await click(
      request,
      destination,
      credential.token,
      headers,
    );
    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe(destination);
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(response.headers()["cache-control"]).toContain("no-store");
    ids.add(response.headers()["x-routeverity-click-id"]);
  }
  expect(ids.size).toBe(variants.length);
  const international = "https://bücher.de/été?q=été#über";
  const encoded =
    "https://xn--bcher-kva.de/%C3%A9t%C3%A9?q=%C3%A9t%C3%A9#%C3%BCber";
  await prisma.routeVerityDestinationDomain.create({
    data: {
      campaignId,
      hostname: "xn--bcher-kva.de",
      includeSubdomains: false,
    },
  });
  const response = await click(request, international);
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(encoded);
  const audit = await prisma.routeVerityRedirectAudit.findUnique({
    where: { clickId: response.headers()["x-routeverity-click-id"] },
  });
  expect(audit?.providedNextHopHash).toBe(fingerprint(international));
  expect(audit?.validatedNextHopHash).toBe(fingerprint(encoded));
  expect(audit?.actualRedirectTargetHash).toBe(fingerprint(encoded));
  expect(
    await prisma.routeVerityRedirectAudit.count({ where: { projectId } }),
  ).toBe(variants.length + 1);
});

test("Google metadata and device/network variants never change the next hop; only identifier hashes are persisted", async ({
  request,
}) => {
  for (const [device, network, agent] of [
    ["c", "g", "AdsBot-Google"],
    ["m", "x", "Mozilla/5.0"],
    ["t", "d", "Googlebot"],
  ]) {
    const response = await request.get(
      `${trackingPath()}&${new URLSearchParams({ device, network, gclid: "fixture_private_google_id", gbraid: "fixture_private_braid", wbraid: "fixture_private_web_braid" })}`,
      { maxRedirects: 0, headers: { Host: host, "User-Agent": agent } },
    );
    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe(destination);
    const audit = await prisma.routeVerityRedirectAudit.findUniqueOrThrow({
      where: { clickId: response.headers()["x-routeverity-click-id"] },
    });
    expect(audit.validatedNextHopHash).toBe(fingerprint(destination));
    expect(audit.actualRedirectTargetHash).toBe(audit.validatedNextHopHash);
    expect(audit.googleAds).toEqual({
      device,
      network,
      gclidHash: fingerprint("fixture_private_google_id"),
      gbraidHash: fingerprint("fixture_private_braid"),
      wbraidHash: fingerprint("fixture_private_web_braid"),
    });
    expect(JSON.stringify(audit)).not.toContain("fixture_private_google_id");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
  for (const extra of [
    "&gclid=a&gclid=b",
    "&gclid=a&%67clid=b",
    "&device={device}",
    "&wbraid=" + "x".repeat(513),
    "&keyword=not-supported",
  ]) {
    const response = await request.get(`${trackingPath()}${extra}`, {
      maxRedirects: 0,
      headers: { Host: host },
    });
    expect(response.status()).toBe(400);
    expect(response.headers().location).toBeUndefined();
  }
  expect(
    await prisma.routeVerityRedirectAudit.count({ where: { projectId } }),
  ).toBe(3);
});

test("rejects ambiguous input, dangerous destinations, foreign hosts and non-GET requests without a redirect or audit", async ({
  request,
}) => {
  const cases: [string, number][] = [
    [`${trackingPath()}&url=https%3A%2F%2Fevil.org`, 400],
    [`${trackingPath()}&%75rl=https%3A%2F%2Fevil.org`, 400],
    [`${trackingPath()}&rv_campaign=${campaignId}`, 400],
    [`${trackingPath()}&rv_click=forged`, 400],
    [`${trackingPath()}&gclid=%7Bgclid%7D`, 400],
    [trackingPath("javascript:alert(1)"), 400],
    [trackingPath("http://example.com"), 400],
    [trackingPath("https://127.0.0.1"), 400],
    [trackingPath("https://example.com/%0d%0aX-Injected:yes"), 400],
    [trackingPath("https://user:secret@example.com"), 400],
    [trackingPath("https://example.com.evil.org"), 403],
    [trackingPath("https://other.example.org"), 403],
    [trackingPath(destination, issueTrackingToken().token), 404],
    ["/click?url=%GG", 400],
    ["/click", 400],
  ];
  for (const [path, status] of cases) {
    const response = await request.get(path, {
      headers: { Host: host },
      maxRedirects: 0,
    });
    expect(
      response.status(),
      path.replace(/rv_token=[^&]+/, "rv_token=REDACTED"),
    ).toBe(status);
    expect(response.headers().location).toBeUndefined();
    expect(response.headers()["x-routeverity-click-id"]).toBeUndefined();
  }
  const foreign = await click(request, destination, credential.token, {
    Host: "foreign.example.test",
    "X-Forwarded-Host": host,
  });
  expect(foreign.status()).toBe(404);
  for (const method of ["HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const response = await request.fetch(trackingPath(), {
      method,
      headers: { Host: host },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(405);
    expect(response.headers().location).toBeUndefined();
  }
  expect(
    await prisma.routeVerityRedirectAudit.count({ where: { projectId } }),
  ).toBe(0);
});

test("fresh requests fail closed immediately after campaign, workspace or domain suspension", async ({
  request,
}) => {
  for (const status of ["DRAFT", "SUSPENDED", "ARCHIVED"] as const) {
    await prisma.routeVerityCampaign.update({
      where: { id: campaignId },
      data: { status },
    });

    expect((await click(request)).status()).toBe(404);
  }
  await prisma.routeVerityCampaign.update({
    where: { id: campaignId },
    data: { status: "ACTIVE" },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { disabledAt: new Date() },
  });
  expect((await click(request)).status()).toBe(404);
  await prisma.project.update({
    where: { id: projectId },
    data: { disabledAt: null },
  });
  await prisma.domain.update({
    where: { id: domainId },
    data: { suspendedAt: new Date() },
  });
  expect((await click(request)).status()).toBe(404);
  await prisma.domain.update({
    where: { id: domainId },
    data: { suspendedAt: null, verified: false },
  });
  expect((await click(request)).status()).toBe(404);
  expect(
    await prisma.routeVerityRedirectAudit.count({ where: { projectId } }),
  ).toBe(0);
});

test("persisted integrity monitoring fails on a mismatched target and passes after controlled cleanup", async () => {
  const clickId = `rvc_probe_${nonce}`;
  await prisma.routeVerityRedirectAudit.create({
    data: {
      clickId,
      requestId: `probe_${nonce}`,
      projectId,
      campaignId,
      trackingDomain: host,
      destinationHostname: "shop.example.com",
      providedNextHopHash: fingerprint(destination),
      validatedNextHopHash: fingerprint(destination),
      actualRedirectTargetHash: fingerprint("https://wrong.example.com"),
      validationResult: "ALLOWED",
      redirectStatus: 302,
      processingTimeMs: 1,
      policyVersion: "isolated-integrity-probe",
      appVersion: "test-fixture",
    },
  });
  const monitor = () =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", join("scripts", "routeverity-redirect-audit.ts")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 15000,
        windowsHide: true,
      },
    );
  const mismatch = monitor();
  expect(mismatch.status).toBe(1);
  expect(mismatch.stderr).toContain("AUDIT_INTEGRITY_MISMATCH");
  expect(mismatch.stderr).not.toContain(credential.token);
  await prisma.routeVerityRedirectAudit.deleteMany({
    where: { clickId, projectId },
  });
  const healthy = monitor();
  expect(healthy.status).toBe(0);
  expect(healthy.stdout).toContain("PASS");
});

test("measures production redirect throughput and latency with durable records, not landing-page fetches", async ({
  request,
}) => {
  for (let i = 0; i < 5; i++) expect((await click(request)).status()).toBe(302);
  const latencies: number[] = [];
  let failures = 0;
  const started = performance.now();
  for (let batch = 0; batch < 25; batch++) {
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        const requestStarted = performance.now();
        const response = await click(request);
        latencies.push(performance.now() - requestStarted);
        if (
          response.status() !== 302 ||
          response.headers().location !== destination
        )
          failures++;
      }),
    );
  }
  const durationMs = performance.now() - started;
  latencies.sort((a, b) => a - b);
  const percentile = (percent: number) =>
    latencies[Math.ceil(percent * latencies.length) - 1];
  console.log(
    JSON.stringify({
      measurement: "local-production-transparent-redirect",
      samples: latencies.length,
      concurrency: 4,
      warmup: 5,
      requests_per_second: Number(
        (latencies.length / (durationMs / 1000)).toFixed(2),
      ),
      median_ms: Number(percentile(0.5).toFixed(2)),
      p95_ms: Number(percentile(0.95).toFixed(2)),
      p99_ms: Number(percentile(0.99).toFixed(2)),
      error_rate: failures / latencies.length,
    }),
  );
  expect(failures).toBe(0);
  expect(
    await prisma.routeVerityRedirectAudit.count({ where: { projectId } }),
  ).toBe(105);
  expect(percentile(0.95)).toBeLessThan(1000);
});

test("real clicks flow through retryable enrichment into tenant-scoped analytics, detail and CSV", async ({
  page,
  request,
}) => {
  const agent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const response = await click(request, destination, credential.token, {
    "User-Agent": agent,
    Referer: "https://advertiser.example.com/private?secret=yes",
  });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(destination);
  const clickId = response.headers()["x-routeverity-click-id"];
  const captured = await prisma.routeVerityRedirectAudit.findUniqueOrThrow({
    where: { clickId },
  });
  expect(captured.rawUserAgent).toBe(agent);
  expect(captured.referrerHostname).toBe("advertiser.example.com");
  expect(captured.enrichedAt).toBeNull();
  await signInWithEmail(page, email);
  await page.goto(`/app/${nonce}/analytics?campaign=${campaignId}`);
  await expect(page.getByTestId("click-total")).toHaveText("1");
  await expect(
    page.getByText("Pending enrichment", { exact: true }),
  ).toBeVisible();
  const scanner = () =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", join("scripts", "routeverity-click-enrichment.ts")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 15000,
        windowsHide: true,
      },
    );
  const first = scanner();
  expect(first.status).toBe(0);
  expect(first.stdout).toContain('"enriched":1');
  const repeated = scanner();
  expect(repeated.status).toBe(0);
  expect(repeated.stdout).toContain('"enriched":0');
  const enriched = await prisma.routeVerityRedirectAudit.findUniqueOrThrow({
    where: { clickId },
  });
  expect(enriched.rawUserAgent).toBeNull();
  expect(enriched.device).toBe("desktop");
  expect(enriched.browser).toBe("Chrome");
  expect(enriched.operatingSystem).toBe("Windows");
  await page.reload();
  await expect(page.getByTestId("click-total")).toHaveText("1");
  await expect(
    page.getByRole("img", { name: /Daily prepared redirect counts/ }),
  ).toBeVisible();
  const csvUrl = await page
    .getByRole("link", { name: "Export filtered CSV" })
    .getAttribute("href");
  const exported = await page.request.get(csvUrl ?? "");
  expect(exported.status()).toBe(200);
  expect(exported.headers()["content-type"]).toContain("text/csv");
  const csv = await exported.text();
  expect(csv).toContain(clickId);
  expect(csv).toContain('"Chrome"');
  expect(csv).not.toContain(agent);
  expect(csv).not.toContain("secret=yes");
  expect(csv).not.toContain(credential.token);
  await page.getByRole("link", { name: clickId, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Click detail" }),
  ).toBeVisible();
  await expect(page.getByText("Chrome", { exact: true })).toBeVisible();
  expect(await page.locator("main").textContent()).not.toContain(agent);
  await page.goto(`/app/${nonce}/analytics?campaign=cmp_foreign`);
  await expect(page.getByTestId("click-total")).toHaveText("0");
  await page.goto(`/app/${nonce}/analytics?device=mobile`);
  await expect(page.getByTestId("click-total")).toHaveText("0");
  await page.goto(`/app/${nonce}/analytics?from=2026-02-30`);
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid analytics filters" }),
  ).toBeVisible();
  const invalidExport = await page.request.get(
    `/app/${nonce}/analytics/export?campaign=a&campaign=b`,
  );
  expect(invalidExport.status()).toBe(400);
  const foreignId = `rvc_foreign_${nonce}`;
  await prisma.routeVerityRedirectAudit.create({
    data: {
      ...captured,
      googleAds: captured.googleAds ?? Prisma.DbNull,
      clickId: foreignId,
      requestId: `foreign_${nonce}`,
      projectId: "ws_foreign_fixture",
      rawUserAgent: null,
    },
  });
  try {
    await page.goto(`/app/${nonce}/analytics/${foreignId}`);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await page.goto(`/app/${nonce}/analytics`);
    await expect(page.getByTestId("click-total")).toHaveText("1");
    await prisma.projectUsers.updateMany({
      where: { projectId },
      data: { role: "viewer" },
    });
    await page.reload();
    await expect(page.getByTestId("click-total")).toHaveText("1");
    expect((await page.request.get(csvUrl ?? "")).status()).toBe(200);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  } finally {
    await prisma.projectUsers.updateMany({
      where: { projectId },
      data: { role: "owner" },
    });
    await prisma.routeVerityRedirectAudit.deleteMany({
      where: { clickId: foreignId, projectId: "ws_foreign_fixture" },
    });
  }
});

test("UTC range boundaries, campaign attribution and pagination count legacy evidence without inventing metadata", async ({
  page,
}) => {
  const base = {
    projectId,
    campaignId,
    trackingDomain: host,
    destinationHostname: "shop.example.com",
    providedNextHopHash: fingerprint(destination),
    validatedNextHopHash: fingerprint(destination),
    actualRedirectTargetHash: fingerprint(destination),
    validationResult: "ALLOWED",
    redirectStatus: 302,
    processingTimeMs: 12,
    policyVersion: "isolated-reporting-fixture",
    appVersion: "fixture",
  };
  await prisma.routeVerityRedirectAudit.createMany({
    data: [
      ...Array.from({ length: 51 }, (_, index) => ({
        ...base,
        clickId: `rvc_range_${nonce}_${index}`,
        requestId: `range_${nonce}_${index}`,
        timestamp: new Date(
          `2026-10-06T${index === 50 ? "23:59:59.999" : "00:00:00.000"}Z`,
        ),
      })),
      {
        ...base,
        clickId: `rvc_before_${nonce}`,
        requestId: `before_${nonce}`,
        timestamp: new Date("2026-10-05T23:59:59.999Z"),
      },
      {
        ...base,
        clickId: `rvc_after_${nonce}`,
        requestId: `after_${nonce}`,
        timestamp: new Date("2026-10-07T00:00:00.000Z"),
      },
    ],
  });
  await signInWithEmail(page, email);
  await page.goto(`/app/${nonce}/analytics?from=2026-10-06&to=2026-10-06`);
  await expect(page.getByTestId("click-total")).toHaveText("51");
  await expect(
    page.getByText("0 enriched; 0 pending; 51 legacy audit only", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^rvc_range_/ })).toHaveCount(50);
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page.getByRole("link", { name: /^rvc_range_/ })).toHaveCount(1);
  const exportUrl = await page
    .getByRole("link", { name: "Export filtered CSV" })
    .getAttribute("href");
  const response = await page.request.get(exportUrl ?? "");
  expect(response.status()).toBe(200);
  const rows = (await response.text()).split("\r\n");
  expect(rows).toHaveLength(52);
  expect(rows.join("\n")).not.toContain(`rvc_before_${nonce}`);
  expect(rows.join("\n")).not.toContain(`rvc_after_${nonce}`);
  await page.goto(`/app/${nonce}/analytics?from=2026-10-04&to=2026-10-06`);
  await expect(page.getByTestId("click-total")).toHaveText("52");
  await page
    .getByText("Daily counts (accessible table)", { exact: true })
    .click();
  await expect(
    page.getByRole("row", { name: "2026-10-04 0", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "2026-10-05 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "2026-10-06 51", exact: true }),
  ).toBeVisible();
});
