import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabase, signInWithEmail } from "./helpers";

const prisma = new PrismaClient();
const slug = `campaign-e2e-${Date.now()}`;
const ownerEmail = `${slug}-owner@routeverity.test`;
const viewerEmail = `${slug}-viewer@routeverity.test`;
const domainId = `dom_${slug}`;
let localValidated = false;

test.beforeAll(async () => {
  assertLocalDatabase();
  localValidated = true;
  const owner = await prisma.user.create({
    data: { email: ownerEmail, emailVerified: new Date() },
  });
  await prisma.project.create({
    data: {
      id: `ws_${slug}`,
      name: "Campaign acceptance",
      slug,
      billingCycleStart: 1,
      users: { create: { userId: owner.id, role: "owner" } },
      domains: {
        create: {
          id: domainId,
          slug: `${slug}.example.test`,
          type: "TRANSPARENT_TRACKING",
          verified: false,
        },
      },
    },
  });
});

test.afterAll(async () => {
  if (!localValidated) {
    await prisma.$disconnect();
    return;
  }
  const campaigns = await prisma.routeVerityCampaign.findMany({
    where: { projectId: `ws_${slug}` },
    select: { id: true },
  });
  await prisma.routeVerityDestinationDomain.deleteMany({
    where: { campaignId: { in: campaigns.map((campaign) => campaign.id) } },
  });
  await prisma.routeVerityCampaign.deleteMany({
    where: { projectId: `ws_${slug}` },
  });
  await prisma.domain.deleteMany({ where: { projectId: `ws_${slug}` } });
  await prisma.projectUsers.deleteMany({ where: { projectId: `ws_${slug}` } });
  await prisma.project.deleteMany({ where: { id: `ws_${slug}` } });
  const users = await prisma.user.findMany({
    where: { email: { in: [ownerEmail, viewerEmail] } },
    select: { id: true },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: users.map((user) => user.id) } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: users.map((user) => user.id) } },
  });
  await prisma.$disconnect();
});

test("campaign CRUD, destination policy, readiness, stale edit and archived deletion", async ({
  page,
  context,
}) => {
  await signInWithEmail(page, ownerEmail);
  await page.goto(`/app/${slug}/campaigns`);
  await expect(
    page.getByRole("heading", { name: "No campaigns yet" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Create campaign", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveValue("GBP");
  await page.getByLabel("Campaign name", { exact: true }).fill("Summer launch");
  await page
    .getByLabel("Advertiser", { exact: true })
    .fill("Example advertiser");
  await page.getByLabel("External campaign ID", { exact: true }).fill("123456");
  await page.getByLabel("utm_source", { exact: true }).fill("google");
  await page
    .getByLabel("utm_campaign", { exact: true })
    .fill("summer & autumn");
  await page.getByRole("button", { name: "Add destination hostname" }).click();
  await page
    .getByLabel("Destination hostname 1", { exact: true })
    .fill("EXAMPLE.COM");
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Summer launch", exact: true }),
  ).toBeVisible();
  const campaignUrl = page.url();
  await expect(
    page.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveValue("GBP");
  await page
    .getByLabel("Landing-page URL")
    .fill("https://shop.example.com/offer");
  await page.getByRole("button", { name: "Check destination" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "not approved" }),
  ).toBeVisible();
  await page.getByLabel("Include subdomains 1", { exact: true }).check();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("ACTIVE");
  await page.getByRole("button", { name: "Save campaign" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Select a transparent tracking domain" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("ACTIVE");
  await expect(page.getByLabel("utm_campaign", { exact: true })).toHaveValue(
    "summer & autumn",
  );
  await expect(
    page.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveValue("GBP");
  await page
    .getByRole("combobox", { name: "Tracking domain", exact: true })
    .selectOption(domainId);
  await page.getByRole("button", { name: "Save campaign" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "not verified" }),
  ).toBeVisible();
  // Local fixture only: the real DNS verifier is covered by separate baseline tests.
  await prisma.domain.update({
    where: { id: domainId },
    data: { verified: true },
  });
  await page.getByRole("button", { name: "Save campaign" }).click();
  await expect(
    page.getByText(
      "Campaign configuration is ready for transparent redirects.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Landing-page URL")
    .fill("https://shop.example.com/offer");
  await page.getByRole("button", { name: "Check destination" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Hostname matches" }),
  ).toBeVisible();
  await page
    .getByLabel("Landing-page URL")
    .fill("https://example.com.evil.org/offer");
  await page.getByRole("button", { name: "Check destination" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "not approved" }),
  ).toBeVisible();
  await page.goto(`/app/${slug}/domains`);
  await page
    .getByRole("button", { name: "Remove domain", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Unassign this domain" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Suspend domain", exact: true })
    .click();
  await expect(page.getByText("Suspended", { exact: true })).toBeVisible();
  await page.goto(campaignUrl);
  await expect(
    page.getByText("Tracking domain is unavailable.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("SUSPENDED");
  await page.getByRole("button", { name: "Save campaign" }).click();
  await expect(
    page.getByText("Campaign is suspended.", { exact: true }),
  ).toBeVisible();
  const secondTab = await context.newPage();
  await secondTab.goto(campaignUrl);
  await secondTab
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Latest revision");
  await secondTab
    .getByRole("combobox", { name: "Currency", exact: true })
    .selectOption("USD");
  await secondTab
    .getByRole("combobox", { name: "Traffic source", exact: true })
    .selectOption("MICROSOFT_ADS");
  await secondTab.getByRole("button", { name: "Save campaign" }).click();
  await expect(
    secondTab.getByRole("status").filter({ hasText: "Campaign saved" }),
  ).toBeVisible();
  await page
    .getByLabel("Landing-page URL")
    .fill("https://shop.example.com/offer");
  await page.getByRole("button", { name: "Check destination" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Hostname matches" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Stale overwrite");
  await page.getByRole("button", { name: "Save campaign" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "changed or is unavailable" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("Latest revision");
  await expect(
    page.getByRole("combobox", { name: "Currency", exact: true }),
  ).toHaveValue("USD");
  await expect(page.getByLabel("utm_campaign", { exact: true })).toHaveValue(
    "summer & autumn",
  );
  await secondTab.close();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("ARCHIVED");
  await page.getByRole("button", { name: "Save campaign" }).click();
  await expect(
    page.getByRole("heading", { name: "Delete archived campaign" }),
  ).toBeVisible();
  await page.getByLabel("I confirm permanent deletion").check();
  await page
    .getByRole("button", { name: "Delete campaign", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/${slug}/campaigns$`));
  await expect(
    page.getByRole("heading", { name: "No campaigns yet" }),
  ).toBeVisible();
});

test("non-member cannot access campaign details; viewer can inspect but cannot create or edit", async ({
  page,
}) => {
  const campaign = await prisma.routeVerityCampaign.create({
    data: {
      id: `cmp_${slug}`,
      projectId: `ws_${slug}`,
      name: "Private campaign",
      advertiser: "Example advertiser",
      trackingParameters: {},
      destinationDomains: { create: { hostname: "example.com" } },
    },
  });
  await signInWithEmail(page, viewerEmail);
  await page.goto(`/app/${slug}/campaigns/${campaign.id}`);
  await expect(page).toHaveURL(/\/app$/);
  const viewer = await prisma.user.findUniqueOrThrow({
    where: { email: viewerEmail },
  });
  await prisma.projectUsers.create({
    data: { userId: viewer.id, projectId: `ws_${slug}`, role: "viewer" },
  });
  await page.goto(`/app/${slug}/campaigns`);
  await expect(
    page.getByRole("link", { name: "Create campaign", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Private campaign", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Saved configuration (read-only)" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save campaign" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", {
      name: "Generate Google Ads template",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto(`/app/${slug}/campaigns/new`);
  await expect(page).toHaveURL(new RegExp(`/app/${slug}/campaigns$`));
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("link", { name: "Private campaign", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
