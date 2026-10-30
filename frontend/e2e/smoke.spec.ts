import { expect, test } from "@playwright/test"

test("manager signs the tablet in, locks it, and a waiter unlocks with a PIN", async ({
  page,
}) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)

  await page.getByRole("button", { name: "Manager" }).click()
  await page.getByRole("button", { name: "Masuk" }).click()
  await expect(page).toHaveURL(/\/floor$/)

  await page.getByRole("button", { name: /Dimas Pratama/ }).click()
  await page.getByRole("menuitem", { name: "Kunci" }).click()

  const lock = page.getByRole("dialog", { name: "Siapa yang bertugas?" })
  await lock.getByRole("button", { name: /Sari Lestari/ }).click()
  for (const digit of "0000")
    await lock.getByRole("button", { name: digit, exact: true }).click()
  await expect(lock.getByRole("alert")).toHaveText("PIN salah.")

  for (const digit of "4444")
    await lock.getByRole("button", { name: digit, exact: true }).click()
  await expect(lock).toBeHidden()
  await expect(page.getByRole("button", { name: /Sari Lestari/ })).toBeVisible()
  // A waiter only takes orders: no snack bar, no back office.
  await expect(page.getByRole("link", { name: "Snack bar" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Back office" })).toHaveCount(0)
})

test("a page outside the user's roles redirects to their start screen", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByRole("button", { name: "Manager" }).click()
  await page.getByRole("button", { name: "Masuk" }).click()
  await expect(page).toHaveURL(/\/floor$/)
  // Managers cannot manage staff; that stays with the owner.
  await page.goto("/admin/staff")
  await expect(page).toHaveURL(/\/floor$/)
})
