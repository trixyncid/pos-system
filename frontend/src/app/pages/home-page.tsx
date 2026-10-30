import { RiseIn } from "@/components/motion/rise-in.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx"
import { Skeleton } from "@/components/ui/skeleton.tsx"
import { useOutletQuery } from "@/features/outlet/hooks/use-outlet.ts"
import { apiErrorMessage } from "@/lib/api-error.ts"
import { env } from "@/lib/env.ts"

/** Placeholder until the PIN lock and floor view land in M1/M4: shows the API wiring works. */
export function HomePage() {
  const outlet = useOutletQuery()

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-6">
      <RiseIn className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">POS System</CardTitle>
            <CardDescription>
              Scaffold ready{env.useMocks ? " · mock API" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {outlet.isPending ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-64" />
              </div>
            ) : outlet.isError ? (
              <p className="text-sm text-danger-ink">
                {apiErrorMessage(outlet.error)}
              </p>
            ) : (
              <div data-testid="outlet">
                <p className="font-heading text-lg font-medium">
                  {outlet.data.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {outlet.data.address}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </RiseIn>
    </main>
  )
}
