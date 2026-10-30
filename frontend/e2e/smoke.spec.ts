import { expect, test } from "@playwright/test"

test("app boots on the mock API and shows the outlet", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByTestId("outlet")).toContainText("Warung Senja")
})
