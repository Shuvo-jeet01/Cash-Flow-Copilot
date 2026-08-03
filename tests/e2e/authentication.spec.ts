import { expect, test } from "@playwright/test";

test("redirects an anonymous user away from protected organization pages", async ({
  page,
}) => {
  await page.goto(
    "/organizations/10000000-0000-4000-8000-000000000001/dashboard",
  );
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("shows sign-up without a client-controlled role field", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(page.locator('[name="role"]')).toHaveCount(0);
});
