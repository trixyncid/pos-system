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

test("owner adds a PIN-only waiter who can then unlock the tablet", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByRole("button", { name: "Owner" }).click()
  await page.getByRole("button", { name: "Masuk" }).click()
  await page.getByRole("link", { name: "Back office" }).click()
  await page.getByRole("link", { name: "Staf" }).click()

  await page.getByRole("button", { name: "Tambah staf" }).click()
  await page.getByLabel("Nama lengkap").fill("Nina Kartika")
  await page.getByLabel("PIN").fill("7777")
  await page.getByRole("checkbox", { name: "Pelayan" }).click()
  await page.getByRole("button", { name: "Simpan" }).click()
  await expect(page.getByText("Nina Kartika ditambahkan")).toBeVisible()

  await page.getByRole("button", { name: /Rina Wijaya/ }).click()
  await page.getByRole("menuitem", { name: "Kunci" }).click()
  const lock = page.getByRole("dialog", { name: "Siapa yang bertugas?" })
  await lock.getByRole("button", { name: /Nina Kartika/ }).click()
  for (const digit of "7777")
    await lock.getByRole("button", { name: digit, exact: true }).click()
  await expect(page).toHaveURL(/\/floor$/)
})

test("a waiter seats a table, orders with choices and sends to the kitchen", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByRole("button", { name: "Manager" }).click()
  await page.getByRole("button", { name: "Masuk" }).click()
  await expect(page).toHaveURL(/\/floor$/)

  await page.getByRole("button", { name: /^Meja 3,/ }).click()
  await page.getByRole("radio", { name: "4", exact: true }).click()
  await page.getByRole("button", { name: "Buka pesanan" }).click()
  await expect(page).toHaveURL(/\/order\//)

  await page.getByRole("button", { name: "Ayam Geprek" }).click()
  await page.getByRole("button", { name: /^Tambah ·/ }).click()
  // The spice level is required: the dialog stays open until it is picked.
  await page.getByRole("radio", { name: /Extra pedas/ }).click()
  await page.getByRole("button", { name: /^Tambah ·/ }).click()
  await page.getByRole("button", { name: /Kirim ke dapur \(1\)/ }).click()
  await expect(page.getByText("1 item terkirim ke dapur")).toBeVisible()

  await page.getByRole("link", { name: "Denah" }).first().click()
  await expect(
    page.getByRole("button", { name: "Meja 3, Dipesan" })
  ).toBeVisible()
})

test("a cashier takes a discount with manager approval and is paid in cash", async ({
  page,
}) => {
  await page.goto("/login")
  await page.getByRole("button", { name: "Manager" }).click()
  await page.getByRole("button", { name: "Masuk" }).click()
  await expect(page).toHaveURL(/\/floor$/)

  await page.getByRole("button", { name: /^Meja 2,/ }).click()
  await expect(page).toHaveURL(/\/order\//)
  await page.getByRole("button", { name: "Diskon" }).click()
  const sheet = page.getByRole("dialog", { name: "Diskon tagihan" })
  await sheet.getByRole("radio", { name: "10%" }).click()
  await sheet.getByRole("radio", { name: "Pelanggan tetap" }).click()
  await sheet.getByRole("button", { name: "Pakai diskon" }).click()
  await expect(page.getByText("Diskon dipakai")).toBeVisible()

  await page.getByRole("button", { name: /^Bayar ·/ }).click()
  await expect(page).toHaveURL(/\/checkout\//)
  await page.getByRole("button", { name: "Uang pas" }).click()
  await page.getByRole("button", { name: /^Terima/ }).click()
  await expect(page.getByText("Pembayaran diterima")).toBeVisible()
  await page.getByRole("button", { name: "Kembali ke denah" }).click()
  await expect(
    page.getByRole("button", { name: "Meja 2, Perlu dibersihkan" })
  ).toBeVisible()
})
