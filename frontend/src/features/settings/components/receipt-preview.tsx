import { useTranslation } from "react-i18next"

import { billTotals, formatIDR, type BillRules } from "@/lib/money.ts"

const sampleLines = [
  { name: "Nasi Goreng Spesial", qty: 2, price: 28_000 },
  { name: "Es Teh Manis", qty: 2, price: 8_000 },
]

function Row({
  left,
  right,
  strong,
}: {
  left: string
  right: string
  strong?: boolean
}) {
  return (
    <div
      className={
        strong ? "flex justify-between font-bold" : "flex justify-between"
      }
    >
      <span>{left}</span>
      <span className="tabular-nums">{right}</span>
    </div>
  )
}

function Rule() {
  return (
    <div
      aria-hidden
      className="my-2 border-t border-dashed border-neutral-400"
    />
  )
}

/**
 * The customer receipt as an 80mm printer lays it out, rebuilt live from the
 * settings form so the owner sees what each rule does to a real bill.
 */
export function ReceiptPreview({
  name,
  address,
  npwpd,
  header,
  footer,
  rules,
}: {
  name: string
  address: string
  npwpd: string
  header: string
  footer: string
  rules: BillRules
}) {
  const { t } = useTranslation()
  const subtotal = sampleLines.reduce(
    (sum, line) => sum + line.qty * line.price,
    0
  )
  const bill = billTotals(subtotal, 0, rules)

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      <div
        className="bg-[#fffdf9] px-5 pt-6 pb-8 font-mono text-[12px] leading-[1.45] text-neutral-900 shadow-(--shadow-raised)"
        style={{
          // A torn-paper bottom edge.
          maskImage:
            "linear-gradient(#000 0 0) top / 100% calc(100% - 8px) no-repeat, radial-gradient(circle at 6px 8px, #000 5px, transparent 5.5px) bottom left / 12px 8px repeat-x",
        }}
      >
        <p className="text-center text-[14px] font-bold uppercase">
          {name || "—"}
        </p>
        {address && (
          <p className="text-center whitespace-pre-line">{address}</p>
        )}
        {header && <p className="text-center whitespace-pre-line">{header}</p>}
        {npwpd && <p className="text-center">NPWPD {npwpd}</p>}
        <Rule />
        <Row left="30/10/2026 19:42" right="#A-0142" />
        <Row left="Meja 7 · Kasir Budi" right="" />
        <Rule />
        {sampleLines.map((line) => (
          <div key={line.name}>
            <p>{line.name}</p>
            <Row
              left={`  ${line.qty} x ${formatIDR(line.price).replace("Rp ", "")}`}
              right={formatIDR(line.qty * line.price).replace("Rp ", "")}
            />
          </div>
        ))}
        <Rule />
        <Row left={t("settings.subtotal")} right={formatIDR(bill.subtotal)} />
        {bill.service > 0 && (
          <Row
            left={`Service ${rules.servicePercent}%`}
            right={formatIDR(bill.service)}
          />
        )}
        {bill.tax > 0 && (
          <Row
            left={`${t("settings.tax")} ${rules.pbjtPercent}%`}
            right={formatIDR(bill.tax)}
          />
        )}
        {bill.rounding !== 0 && (
          <Row
            left={t("settings.roundingLine")}
            right={`${bill.rounding > 0 ? "+" : "−"}${formatIDR(Math.abs(bill.rounding))}`}
          />
        )}
        <Rule />
        <Row strong left={t("settings.total")} right={formatIDR(bill.total)} />
        <Row left="Tunai" right={formatIDR(100_000)} />
        <Row left="Kembali" right={formatIDR(100_000 - bill.total)} />
        {footer && (
          <>
            <Rule />
            <p className="text-center whitespace-pre-line">{footer}</p>
          </>
        )}
      </div>
    </div>
  )
}
