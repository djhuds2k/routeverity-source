import { publicPaths } from "@/lib/routeverity/indexing-policy.cjs";
import { expect, test } from "@playwright/test";

test("public evaluation pages disclose scope and contacts with private-safe metadata", async ({
  page,
  request,
}) => {
  const titles = new Set<string>();
  for (const path of publicPaths) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      path === "/"
        ? new URL(process.env.NEXTAUTH_URL!).origin
        : new URL(path, process.env.NEXTAUTH_URL).toString(),
    );
    const title = await page.title();
    expect(titles.has(title)).toBe(false);
    titles.add(title);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/contact");
  await expect(
    page.getByText("Operated by Multitouch Displays Ltd.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Email RouteVerity" }),
  ).toHaveAttribute("href", "mailto:contact@routeverity.com");
  await page.goto("/google-ads");
  await expect(
    page.getByRole("heading", { name: "Certification status: not submitted" }),
  ).toBeVisible();
  await expect(
    page.getByText(/single eligible retained request/),
  ).toBeVisible();
  await page.goto("/transparency");
  await expect(
    page.getByText(/not represented as matching the current evaluation build/),
  ).toBeVisible();
  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const rules = await request.get("/robots.txt");
  expect(rules.status()).toBe(200);
  expect(await rules.text()).toContain("Disallow: /");
  const map = await request.get("/sitemap.xml");
  expect(map.status()).toBe(200);
  expect(await map.text()).not.toContain("<loc>");
  const unknown = await request.get("/not-a-public-page");
  expect(unknown.status()).toBe(404);
  expect(unknown.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});
