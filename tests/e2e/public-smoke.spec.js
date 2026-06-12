import { expect, test } from "@playwright/test";

test("public landing page and health endpoint render", async ({ page, request }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Track every EUR, USDC, and BTC step/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toBeVisible();

  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  const healthJson = await health.json();
  expect(typeof healthJson.ok).toBe("boolean");
  expect(Array.isArray(healthJson.missing)).toBe(true);

  if (healthJson.ok) {
    await expect(page.getByRole("link", { name: "Open dashboard" })).toBeVisible();
  } else {
    await expect(page.getByText("Public release setup pending")).toBeVisible();
  }
});

test("dashboard shows setup guard when release env is missing", async ({ page }) => {
  await page.goto("/dashboard");

  const setupGuard = page.getByRole("heading", { name: "Account services are not connected yet." });
  const signIn = page.getByRole("heading", { name: /sign in/i });

  await expect(setupGuard.or(signIn).first()).toBeVisible();
});

test("wallet activity route is guarded", async ({ page }) => {
  await page.goto("/wallet");

  const setupGuard = page.getByRole("heading", { name: "Account services are not connected yet." });
  const signIn = page.getByRole("heading", { name: /sign in/i });

  await expect(setupGuard.or(signIn).first()).toBeVisible();
});
