import { expect, test } from "@playwright/test";

const organizationId = "10000000-0000-4000-8000-000000000001";

test("anonymous users cannot open Phase 5B financial routes", async ({
  page,
}) => {
  for (const route of [
    "dashboard?horizon=90",
    "budgets",
    "budgets/new",
    "obligations",
    "obligations/new",
    "settings",
  ]) {
    await page.goto(`/organizations/${organizationId}/${route}`);
    await expect(page).toHaveURL(/\/sign-in/);
  }
});
