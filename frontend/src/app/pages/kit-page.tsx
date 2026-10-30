import { PlusIcon, ScanBarcodeIcon, SendIcon } from "lucide-react"
import { useState } from "react"

import { Pressable } from "@/components/motion/pressable.tsx"
import { MoneyText } from "@/components/pos/money-text.tsx"
import { NumPad } from "@/components/pos/num-pad.tsx"
import { ProductImage } from "@/components/pos/product-image.tsx"
import { QtyStepper } from "@/components/pos/qty-stepper.tsx"
import { StaffAvatar } from "@/components/pos/staff-avatar.tsx"
import { StatusPill } from "@/components/pos/status-pill.tsx"
import { TouchSheet } from "@/components/pos/touch-sheet.tsx"
import { useTheme } from "@/components/theme-provider.tsx"
import { Button } from "@/components/ui/button.tsx"
import { mockPhotos } from "@/mocks/db/photos.ts"

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** Development only: every design-system piece on one page, for review at tablet size. */
export function KitPage() {
  const { theme, setTheme } = useTheme()
  const [qty, setQty] = useState(2)
  const [amount, setAmount] = useState(48_500)
  const [cash, setCash] = useState("")
  const [sheet, setSheet] = useState(false)

  return (
    <main className="min-h-dvh bg-canvas p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-12">
        <header className="flex items-center justify-between">
          <h1 className="font-heading text-3xl font-semibold">Design kit</h1>
          <Button
            variant="outline"
            size="touch"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
        </header>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xl">
              <SendIcon />
              Kirim ke Dapur (3)
            </Button>
            <Button size="touch">Bayar</Button>
            <Button size="touch" variant="secondary">
              Tahan
            </Button>
            <Button size="touch" variant="outline">
              Pisah bill
            </Button>
            <Button size="touch" variant="destructive">
              Void
            </Button>
            <Button size="icon-touch" variant="secondary" aria-label="Scan">
              <ScanBarcodeIcon />
            </Button>
          </div>
        </Section>

        <Section title="Status">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="success">Kosong</StatusPill>
            <StatusPill tone="accent" pulse>
              Terisi · 32 mnt
            </StatusPill>
            <StatusPill tone="warning">Bill dicetak</StatusPill>
            <StatusPill tone="info">Dipesan</StatusPill>
            <StatusPill tone="danger">Perlu dibersihkan</StatusPill>
            <StatusPill>Nonaktif</StatusPill>
          </div>
        </Section>

        <Section title="Numbers and quantity">
          <div className="flex flex-wrap items-center gap-8">
            <QtyStepper
              value={qty}
              onChange={setQty}
              labels={{ decrease: "Kurangi", increase: "Tambah" }}
            />
            <MoneyText
              amount={amount}
              animate
              className="font-heading text-4xl font-semibold"
            />
            <Button
              size="touch"
              variant="secondary"
              onClick={() => setAmount((value) => value + 18_000)}
            >
              <PlusIcon />
              Rp 18.000
            </Button>
          </div>
        </Section>

        <Section title="Keypad">
          <div className="flex flex-wrap items-start gap-10">
            <div className="w-72">
              <p className="mb-3 text-right font-heading text-3xl font-semibold tabular-nums">
                <MoneyText amount={Number(cash || 0)} />
              </p>
              <NumPad
                onDigit={(digit) =>
                  setCash((value) =>
                    (value + digit).replace(/^0+/, "").slice(0, 9)
                  )
                }
                onBackspace={() => setCash((value) => value.slice(0, -1))}
                deleteLabel="Hapus"
                bottomLeft={{
                  label: "Tambah 000",
                  content: "000",
                  onPress: () =>
                    setCash((value) =>
                      value ? `${value}000`.slice(0, 9) : value
                    ),
                }}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                "Rina Wijaya",
                "Dimas Pratama",
                "Budi Santoso",
                "Sari Lestari",
              ].map((name) => (
                <StaffAvatar key={name} name={name} size="lg" />
              ))}
            </div>
          </div>
        </Section>

        <Section title={`Photos (${mockPhotos.length})`}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {mockPhotos.map((photo) => (
              <Pressable
                key={photo.key}
                className="overflow-hidden rounded-2xl bg-card text-left shadow-(--shadow-soft)"
              >
                <ProductImage
                  src={photo.src}
                  srcSet={`${photo.srcSmall} 400w, ${photo.src} 800w`}
                  sizes="(min-width: 1024px) 20vw, 33vw"
                  alt={photo.subject}
                  className="aspect-4/3"
                />
                <p className="truncate px-3 py-2 text-sm font-medium">
                  {photo.subject}
                </p>
              </Pressable>
            ))}
            <div className="overflow-hidden rounded-2xl bg-card shadow-(--shadow-soft)">
              <ProductImage alt="Tanpa foto" className="aspect-4/3" />
              <p className="px-3 py-2 text-sm font-medium">Tanpa foto</p>
            </div>
          </div>
        </Section>

        <Section title="Sheet">
          <Button size="touch" onClick={() => setSheet(true)}>
            Buka sheet
          </Button>
          <TouchSheet
            open={sheet}
            onOpenChange={setSheet}
            title="Nasi goreng spesial"
            description="Pilih level pedas dan tambahan."
            footer={
              <Button
                size="xl"
                className="w-full"
                onClick={() => setSheet(false)}
              >
                Tambah · <MoneyText amount={32_000} />
              </Button>
            }
          >
            <p className="text-muted-foreground">
              The item sheet is designed in M5.
            </p>
          </TouchSheet>
        </Section>
      </div>
    </main>
  )
}
