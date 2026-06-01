import { expect, test } from "@playwright/test";

test("public setup page and health endpoint render", async ({ page, request }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Track every EUR, USDC, and BTC step/i })).toBeVisible();
  await expect(page.getByText("Public release setup pending")).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();

  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  await expect(await health.json()).toEqual({
    ok: false,
    authConfigured: false,
    databaseConfigured: false,
    missing: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "DATABASE_URL"],
  });
});

test("dashboard shows setup guard when release env is missing", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Account services are not connected yet." })).toBeVisible();
  await expect(page.getByText("Clerk login/register routes are implemented.")).toBeVisible();
  await expect(page.getByText("Neon ledger API routes are implemented.")).toBeVisible();
});
