import { expect, type Page } from "@playwright/test";

export function assertLocalDatabase() {
  const database = new URL(process.env.DATABASE_URL ?? "");
  expect(database.hostname).toBe("127.0.0.1");
  expect(database.port).toBe("13306");
  expect(database.pathname).toBe("/routeverity");
}

export async function signInWithEmail(page: Page, email: string) {
  await page.goto("/login");
  const before: { items: { ID: string }[] } = await (
    await page.request.get("http://127.0.0.1:18025/api/v2/messages")
  ).json();
  const oldIds = new Set(before.items.map((message) => message.ID));
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page).toHaveURL(/\/login\/check-email$/);
  let verificationUrl: string | undefined;
  await expect(async () => {
    const response = await page.request.get(
      "http://127.0.0.1:18025/api/v2/messages",
    );
    expect(response.ok()).toBeTruthy();
    const inbox: {
      items: {
        ID: string;
        To: { Mailbox: string; Domain: string }[];
        Content: { Body: string };
      }[];
    } = await response.json();
    const message = inbox.items.find(
      (item) =>
        !oldIds.has(item.ID) &&
        item.To.some((to) => `${to.Mailbox}@${to.Domain}` === email),
    );
    expect(message).toBeDefined();
    const body = message!.Content.Body.replace(/=\r?\n/g, "").replaceAll(
      "=3D",
      "=",
    );
    verificationUrl = body
      .match(
        /https?:\/\/localhost:8888\/api\/auth\/callback\/email\?[^\s"<>]+/,
      )?.[0]
      .replaceAll("&amp;", "&");
    expect(verificationUrl).toBeDefined();
  }).toPass({ timeout: 10_000 });
  await page.goto(verificationUrl!);
  await expect(page).toHaveURL(/\/app$/);
}
