import { Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button.tsx"

export function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Halaman tidak ditemukan</h1>
        <Button asChild size="lg">
          <Link to="/">Kembali</Link>
        </Button>
      </div>
    </main>
  )
}
