import { expect, test } from "@playwright/test";

test("public setup page and health endpoint render", async ({ page, request }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Track every EUR, USDC, and BTC step/i })).toBeVisible();
  await expect(page.getByText("Public release setup pending")).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();

  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  const healthJson = await health.json();
  expect(healthJson.ok).toBe(false);
  expect(healthJson.databaseConfigured).toBe(false);
  expect(healthJson.missing).toContain("DATABASE_URL");
});

test("dashboard shows setup guard when release env is missing", async ({ page }) => {
  await page.goto("/dashboard");

  const setupGuard = page.getByRole("heading", { name: "Account services are not connected yet." });
  const signIn = page.getByRole("heading", { name: /sign in/i });

  await expect(setupGuard.or(signIn).first()).toBeVisible();
});
