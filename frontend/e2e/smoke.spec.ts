import { expect, test, type Page } from "@playwright/test"

async function signIn(page: Page, username: string) {
  await page.goto("/login")
  await page.getByLabel("Username").fill(username)
  await page.getByLabel("Kata sandi").fill("demo1234")
  await page.getByRole("button", { name: "Masuk", exact: true }).click()
}

test("a waiter signs in to their own account and only takes orders", async ({
  page,
}) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login$/)

  await signIn(page, "sari")
  await expect(page).toHaveURL(/\/floor$/)
  await expect(page.getByRole("button", { name: /Sari Lestari/ })).toBeVisible()
  await expect(page.getByRole("link", { name: "Snack bar" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Back office" })).toHaveCount(0)
})

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Username").fill("budi")
  await page.getByLabel("Kata sandi").fill("nope1234")
  await page.getByRole("button", { name: "Masuk", exact: true }).click()
  await expect(page.getByRole("alert")).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test("a page outside the user's roles redirects to their start screen", async ({
  page,
}) => {
  await signIn(page, "budi")
  await expect(page).toHaveURL(/\/floor$/)
  // Kasir cannot manage staff; that stays with the owner.
  await page.goto("/admin/staff")
  await expect(page).toHaveURL(/\/floor$/)
})

test("owner adds a waiter who then signs in with their own account", async ({
  page,
}) => {
  await signIn(page, "rina")
  await page.getByRole("link", { name: "Back office" }).click()
  await page.getByRole("link", { name: "Staf" }).click()

  await page.getByRole("button", { name: "Tambah staf" }).click()
  await page.getByLabel("Nama lengkap").fill("Nina Kartika")
  await page.getByLabel("Username").fill("nina")
  await page.getByLabel("Kata sandi").fill("nina12345")
  await page.getByRole("checkbox", { name: "Pelayan" }).click()
  await page.getByRole("button", { name: "Simpan" }).click()
  await expect(page.getByText("Nina Kartika ditambahkan")).toBeVisible()

  await page.getByRole("button", { name: /Rina Wijaya/ }).click()
  await page.getByRole("menuitem", { name: "Keluar" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel("Username").fill("nina")
  await page.getByLabel("Kata sandi").fill("nina12345")
  await page.getByRole("button", { name: "Masuk", exact: true }).click()
  await expect(page).toHaveURL(/\/floor$/)
})

test("a waiter seats a table, orders with choices and sends to the kitchen", async ({
  page,
}) => {
  await signIn(page, "budi")
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

test("a cashier takes a discount and is paid in cash", async ({ page }) => {
  await signIn(page, "budi")
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
    page.getByRole("button", { name: "Meja 2, Kosong" })
  ).toBeVisible()
})

test("the snack bar sells a scanned item for cash", async ({ page }) => {
  await signIn(page, "budi")
  await page.getByRole("link", { name: "Snack bar" }).click()
  await expect(page.getByText("Siap scan")).toBeVisible()

  // A scanner gun types the code a few milliseconds per key, then Enter.
  for (const key of [..."8991000000000", "Enter"])
    await page.keyboard.press(key)
  await expect(page.getByRole("button", { name: /^Bayar · Rp/ })).toBeEnabled()
  for (const key of [..."0000000000000", "Enter"])
    await page.keyboard.press(key)
  await expect(
    page.getByText("Barcode 0000000000000 tidak dikenal.")
  ).toBeVisible()

  await page.getByRole("button", { name: /^Bayar · Rp/ }).click()
  await page.getByRole("button", { name: "Uang pas" }).click()
  await page.getByRole("button", { name: /^Terima/ }).click()
  await expect(page.getByText("Pembayaran diterima")).toBeVisible()
})

test("a cashier receives a delivery and counts stock", async ({ page }) => {
  await signIn(page, "budi")
  await page.getByRole("link", { name: "Back office" }).click()
  await page.getByRole("link", { name: "Stok" }).click()
  await expect(page.getByRole("heading", { name: "Stok" })).toBeVisible()

  await page.getByRole("button", { name: "Terima barang" }).click()
  const receive = page.getByRole("dialog", { name: "Terima barang" })
  await receive.getByPlaceholder("Cari barang untuk ditambahkan").fill("telur")
  await receive.getByRole("button", { name: /Telur/ }).click()
  await receive.getByLabel("Jumlah").fill("30")
  await receive.getByRole("button", { name: "Simpan 1 barang" }).click()
  await expect(page.getByText("1 barang diterima")).toBeVisible()

  await page.getByRole("button", { name: "Stock opname" }).click()
  const count = page.getByRole("dialog", { name: "Stock opname" })
  await count.getByLabel("Jumlah Telur di rak").fill("50")
  await count.getByRole("button", { name: /^Simpan opname/ }).click()
  await expect(page.getByText("1 dihitung, 1 disesuaikan")).toBeVisible()
})

test("the owner reads the dashboard, a report and the audit log", async ({
  page,
}) => {
  await signIn(page, "rina")
  await page.getByRole("link", { name: "Back office" }).click()
  await page.getByRole("link", { name: "Dashboard" }).click()
  await expect(page.getByText("Penjualan per jam")).toBeVisible()
  await expect(page.getByText("Item terlaris")).toBeVisible()

  await page.getByRole("link", { name: "Laporan" }).click()
  await page.getByRole("button", { name: /7 hari terakhir/ }).click()
  await page.getByRole("button", { name: "30 hari terakhir" }).click()
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Unduh CSV" }).click()
  expect((await download).suggestedFilename()).toMatch(/^penjualan_.*\.csv$/)

  await page.getByRole("link", { name: "Log audit" }).click()
  await page.getByRole("radio", { name: "Pesanan" }).click()
  await expect(page.getByText("Void item").first()).toBeVisible()
})
