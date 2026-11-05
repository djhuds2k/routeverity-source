import { prisma } from "@/lib/prisma";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { assertLocalDatabase, signInWithEmail } from "./helpers";

const operatorEmail = "operator-e2e@routeverity.test";

test("verified operator can audit workspace suspension/resumption; members cannot access controls", async ({
  page,
  browser,
}) => {
  test.skip(
    process.env.ROUTEVERITY_OPERATOR_EMAIL !== operatorEmail,
    "Requires the dedicated local operator profile on both server and runner.",
  );
  assertLocalDatabase();
  const smtp = new URL(process.env.EMAIL_SERVER ?? "");
  expect(["localhost", "127.0.0.1"]).toContain(smtp.hostname);
  expect(smtp.port).toBe("11025");
  const previousOperator = await prisma.user.findUnique({
    where: { email: operatorEmail },
  });
  expect(previousOperator).toBeNull();
  const nonce = randomUUID().replaceAll("-", "").slice(0, 18);
  const ownerEmail = `ops-owner-${nonce}@routeverity.test`;
  const slug = `ops-${nonce}`;
  const operatorContext = await browser.newContext();
  let operatorCreated = false;
  try {
    await signInWithEmail(page, ownerEmail);
    await expect(
      page.getByRole("link", { name: "Operator controls", exact: true }),
    ).toHaveCount(0);
    expect((await page.request.get("/operations")).status()).toBe(404);
    await page.getByLabel("Workspace name").fill(`Operator fixture ${nonce}`);
    await page.getByLabel("Workspace address").fill(slug);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/${slug}$`));
    await page
      .getByRole("navigation", { name: "Workspace" })
      .getByRole("link", { name: "Links", exact: true })
      .click();
    await page.getByLabel("Link key").fill("operator-check");
    await page
      .getByLabel("Destination URL")
      .fill("http://localhost:8888/features");
    await page
      .getByRole("button", { name: "Create link", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Standard link created",
    );
    expect(
      (
        await page.request.get(`/r/${slug}/operator-check`, { maxRedirects: 0 })
      ).status(),
    ).toBe(302);
    const workspace = await prisma.project.findUniqueOrThrow({
      where: { slug },
    });

    const operatorPage = await operatorContext.newPage();
    await signInWithEmail(operatorPage, operatorEmail);
    operatorCreated = true;
    await operatorPage
      .getByRole("link", { name: "Operator controls", exact: true })
      .click();
    await expect(
      operatorPage.getByRole("heading", {
        name: "Worker and dependency health",
        exact: true,
      }),
    ).toBeVisible();
    await operatorPage.getByLabel("Workspace address").fill(slug);
    await operatorPage.getByRole("button", { name: "Find workspace" }).click();
    const card = operatorPage.locator("section").filter({
      has: operatorPage.getByRole("heading", {
        name: `Operator fixture ${nonce}`,
        exact: true,
      }),
    });
    await expect(card).toContainText("Available");
    const operator = await prisma.user.findUniqueOrThrow({
      where: { email: operatorEmail },
    });
    await prisma.user.update({
      where: { id: operator.id },
      data: { emailVerified: null },
    });
    await card.getByLabel("Reason").fill("E2E verification revocation check");
    await card
      .getByRole("button", { name: "Suspend workspace", exact: true })
      .click();
    await expect(card.getByRole("alert")).toContainText(
      "Operator access is required",
    );
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: workspace.id } }))
        .disabledAt,
    ).toBeNull();
    expect(
      await prisma.routeVerityOperatorEvent.count({
        where: { projectId: workspace.id },
      }),
    ).toBe(0);
    await prisma.user.update({
      where: { id: operator.id },
      data: { emailVerified: new Date() },
    });

    await card.getByLabel("Reason").fill("E2E abuse investigation");
    await card
      .getByRole("button", { name: "Suspend workspace", exact: true })
      .click();
    await expect(card.getByRole("status")).toContainText(
      "suspended; audit recorded",
    );
    await expect(
      card.getByRole("button", { name: "Resume workspace", exact: true }),
    ).toBeVisible();
    expect(
      (
        await page.request.get(`/r/${slug}/operator-check`, { maxRedirects: 0 })
      ).status(),
    ).toBe(404);
    await page.goto(`/app/${slug}`);
    await expect(page).toHaveURL(/\/app$/);
    await expect(
      page.getByRole("link").filter({ hasText: `Operator fixture ${nonce}` }),
    ).toHaveCount(0);
    const firstAudit = await prisma.routeVerityOperatorEvent.findMany({
      where: { projectId: workspace.id },
    });
    expect(firstAudit).toHaveLength(1);
    expect(firstAudit[0]).toMatchObject({
      actorId: operator.id,
      operation: "WORKSPACE_SUSPENDED",
      reason: "E2E abuse investigation",
      wasDisabled: false,
      isDisabled: true,
    });

    await card.getByLabel("Reason").fill("E2E investigation complete");
    await card
      .getByRole("button", { name: "Resume workspace", exact: true })
      .click();
    await expect(card.getByRole("status")).toContainText(
      "resumed; audit recorded",
    );
    await expect(
      card.getByRole("button", { name: "Suspend workspace", exact: true }),
    ).toBeVisible();
    expect(
      (
        await page.request.get(`/r/${slug}/operator-check`, { maxRedirects: 0 })
      ).status(),
    ).toBe(302);
    await page.goto(`/app/${slug}`);
    await expect(page).toHaveURL(new RegExp(`/app/${slug}$`));
    const events = await prisma.routeVerityOperatorEvent.findMany({
      where: { projectId: workspace.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      operation: "WORKSPACE_RESUMED",
      reason: "E2E investigation complete",
      wasDisabled: true,
      isDisabled: false,
    });
  } finally {
    await operatorContext.close();
    const workspace = await prisma.project.findUnique({ where: { slug } });
    if (workspace) {
      await prisma.routeVerityOperatorEvent.deleteMany({
        where: { projectId: workspace.id },
      });
      await prisma.link.deleteMany({ where: { projectId: workspace.id } });
      await prisma.domain.deleteMany({ where: { projectId: workspace.id } });
      await prisma.projectUsers.deleteMany({
        where: { projectId: workspace.id },
      });
      await prisma.project.delete({ where: { id: workspace.id } });
    }
    await prisma.user.deleteMany({ where: { email: ownerEmail } });
    if (operatorCreated)
      await prisma.user.deleteMany({ where: { email: operatorEmail } });
  }
});
