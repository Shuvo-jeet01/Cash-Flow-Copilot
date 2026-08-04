import { expect, test } from "@playwright/test";

const organizationId = "10000000-0000-4000-8000-000000000001";

test("anonymous users cannot open Phase 5A financial routes", async ({
  page,
}) => {
  for (const route of ["transactions", "accounts", "categories", "imports"]) {
    await page.goto(`/organizations/${organizationId}/${route}`);
    await expect(page).toHaveURL(/\/sign-in/);
  }
});

test("the documented CSV template is downloadable without real financial data", async ({
  request,
}) => {
  const response = await request.get("/templates/transactions-v1.csv");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toContain("transaction_date,direction,amount,currency");
  expect(body).toContain("Synthetic example");
  expect(body).not.toMatch(/routing|account number|card number/i);
});
