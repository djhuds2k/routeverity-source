import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabase, signInWithEmail } from "./helpers";

const prisma = new PrismaClient();
const slug = `e2e-${Date.now()}`;
const email = `${slug}@routeverity.test`;
const otherEmail = `${slug}-other@routeverity.test`;
const fixtureEmail = `${slug}-fixture@routeverity.test`;
const roleSlug = `${slug}-roles`;
const domain = `${slug}.example.test`;
let localValidated = false;

test.beforeAll(() => {
  assertLocalDatabase();
  localValidated = true;
});

test.afterAll(async () => {
  if (!localValidated) {
    await prisma.$disconnect();
    return;
  }
  const workspaces = await prisma.project.findMany({
    where: { slug: { in: [slug, roleSlug] } },
  });
  for (const workspace of workspaces) {
    await prisma.link.deleteMany({ where: { projectId: workspace.id } });
    await prisma.domain.deleteMany({ where: { projectId: workspace.id } });
    await prisma.projectUsers.deleteMany({
      where: { projectId: workspace.id },
    });
    await prisma.project.delete({ where: { id: workspace.id } });
  }
  const users = await prisma.user.findMany({
    where: { email: { in: [email, otherEmail, fixtureEmail] } },
  });
  for (const user of users) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
});

test("verified account -> workspace -> standard link -> domains -> settings -> logout -> login", async ({
  page,
}) => {
  await signInWithEmail(page, email);
  await page.getByLabel("Workspace name").fill("RouteVerity E2E");
  await page.getByLabel("Workspace address").fill(slug);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${slug}$`));
  await expect(
    page.getByRole("link", {
      name: "Free corresponding source (AGPL)",
      exact: true,
    }),
  ).toHaveAttribute(
    "href",
    "https://github.com/djhuds2k/routeverity-source/archive/refs/tags/v0.1.0-preproduction.20261007.zip",
  );
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Workspace" });
  await expect(navigation).not.toContainText("Admin");
  await expect(
    navigation.getByRole("link", { name: "Conversions", exact: true }),
  ).toBeVisible();
  await navigation.getByRole("link", { name: "Links", exact: true }).click();
  await page.getByLabel("Link key").fill("acceptance");
  await page
    .getByLabel("Destination URL")
    .fill("http://localhost:8888/features?utm_source=e2e");
  await page.getByRole("button", { name: "Create link", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Standard link created");
  const redirect = await page.request.get(`/r/${slug}/acceptance`, {
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toBe(
    "http://localhost:8888/features?utm_source=e2e",
  );
  await navigation.getByRole("link", { name: "Domains", exact: true }).click();
  await page
    .getByRole("button", { name: "Suspend domain", exact: true })
    .click();
  await expect(page.getByText("Suspended", { exact: true })).toBeVisible();
  expect(
    (
      await page.request.get(`/r/${slug}/acceptance`, { maxRedirects: 0 })
    ).status(),
  ).toBe(404);
  await page
    .getByRole("button", { name: "Resume domain", exact: true })
    .click();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  expect(
    (
      await page.request.get(`/r/${slug}/acceptance`, { maxRedirects: 0 })
    ).status(),
  ).toBe(302);
  await page
    .getByRole("button", { name: "Remove domain", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Remove the domain's links" }),
  ).toBeVisible();
  expect(
    (
      await page.request.get(`/r/${slug}/acceptance`, { maxRedirects: 0 })
    ).status(),
  ).toBe(302);
  await page.getByLabel("Hostname").fill(domain);
  await page.getByRole("button", { name: "Add domain", exact: true }).click();
  const card = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: domain, exact: true }) });
  await expect(card).toContainText("Pending verification");
  await card.getByRole("button", { name: "Check DNS" }).click();
  await expect(card.getByRole("alert")).toContainText("TXT record not found");
  await card.getByRole("button", { name: "Remove domain" }).click();
  await expect(card).toHaveCount(0);
  await page.getByLabel("Hostname").fill(`tracking-${domain}`);
  await page.getByLabel("Domain type").selectOption("TRANSPARENT_TRACKING");
  await page.getByRole("button", { name: "Add domain", exact: true }).click();
  const trackingCard = page.locator("section").filter({
    has: page.getByRole("heading", { name: `tracking-${domain}`, exact: true }),
  });
  await expect(trackingCard).toContainText(
    "Transparent tracking uses HTTPS /click",
  );
  await expect(trackingCard).toContainText("not working DNS routing or TLS");
  await expect(trackingCard).not.toContainText("not implemented");
  await trackingCard.getByRole("button", { name: "Remove domain" }).click();
  await expect(trackingCard).toHaveCount(0);
  await navigation.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Workspace name").fill("RouteVerity E2E Verified");
  await page.getByRole("button", { name: "Save workspace" }).click();
  await expect(page.getByRole("status")).toContainText("Workspace name saved");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(`/app/${slug}`);
  await expect(page).toHaveURL(/\/login$/);
  await signInWithEmail(page, email);
  await page
    .getByRole("link")
    .filter({ hasText: "RouteVerity E2E Verified" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/${slug}$`));
  await navigation.getByRole("link", { name: "Links", exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: `http://localhost:8888/r/${slug}/acceptance`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove link", exact: true }).click();
  await expect(page.getByText("No links yet.", { exact: false })).toBeVisible();
});

test("a second account cannot read a foreign workspace; viewers have no write surfaces", async ({
  page,
}) => {
  const owner = await prisma.user.create({ data: { email: fixtureEmail } });
  const workspace = await prisma.project.create({
    data: {
      id: `ws_${roleSlug}`,
      slug: roleSlug,
      name: "Foreign fixture workspace",
      billingCycleStart: 1,
      users: { create: { userId: owner.id, role: "owner" } },
    },
  });
  await signInWithEmail(page, otherEmail);
  await page.goto(`/app/${roleSlug}/links`);
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByText("Foreign fixture workspace", { exact: true }),
  ).toHaveCount(0);
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: otherEmail },
  });
  await prisma.projectUsers.create({
    data: { projectId: workspace.id, userId: user.id, role: "viewer" },
  });
  await page.goto(`/app/${roleSlug}/links`);
  await expect(
    page.getByRole("heading", { name: "Links", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create link", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/app/${roleSlug}/domains`);
  await expect(
    page.getByRole("button", { name: "Add domain", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Suspend domain", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/app/${roleSlug}/settings`);
  await expect(page.getByLabel("Workspace name")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save workspace", exact: true }),
  ).toHaveCount(0);
});

test("public and authentication layouts fit mobile; audited logo renders", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(
    page.getByRole("link", {
      name: "Free corresponding source (AGPL)",
      exact: true,
    }),
  ).toHaveAttribute(
    "href",
    "https://github.com/djhuds2k/routeverity-source/archive/refs/tags/v0.1.0-preproduction.20261007.zip",
  );
  await expect(page.locator("aside")).toBeHidden();
  const logo = page.getByRole("img", { name: "RouteVerity", exact: true });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveJSProperty("complete", true);
  expect(
    await logo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/");
  await expect(
    page.getByRole("link", {
      name: "Free corresponding source (AGPL)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Transparent click tracking",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
