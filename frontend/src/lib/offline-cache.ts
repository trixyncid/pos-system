import type { QueryClient, QueryKey } from "@tanstack/react-query"

/**
 * A copy of what the snack bar needs to keep selling with no internet (the
 * products, categories, outlet rules and the open shift), kept in this
 * browser and put back into the query cache when the app starts. The
 * server's answer replaces it as soon as it can be reached.
 */
const storageKey = "pos.offline.cache"

/** Query keys kept, by their first two parts. */
const KEPT: QueryKey[] = [
  ["catalog", "products"],
  ["catalog", "categories"],
  ["outlet"],
  ["shifts", "current"],
]

type Entry = { key: QueryKey; data: unknown; updatedAt: number }

function storage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function kept(key: QueryKey) {
  return KEPT.some((prefix) => prefix.every((part, i) => key[i] === part))
}

function read(): Entry[] {
  try {
    return JSON.parse(storage()?.getItem(storageKey) ?? "[]") as Entry[]
  } catch {
    return []
  }
}

/** Put the saved copy back, without overwriting anything already fetched. */
export function restoreOfflineCache(queryClient: QueryClient) {
  for (const entry of read()) {
    if (queryClient.getQueryData(entry.key) === undefined)
      queryClient.setQueryData(entry.key, entry.data, {
        updatedAt: entry.updatedAt,
      })
  }
}

export function clearOfflineCache() {
  storage()?.removeItem(storageKey)
}

/** Save the kept queries whenever one of them gets fresh data from the server. */
export function keepOfflineCache(queryClient: QueryClient) {
  let timer: number | null = null
  const save = () => {
    timer = null
    const entries: Entry[] = queryClient
      .getQueryCache()
      .findAll({ predicate: (query) => kept(query.queryKey) })
      .filter((query) => query.state.data !== undefined)
      .map((query) => ({
        key: query.queryKey,
        data: query.state.data,
        updatedAt: query.state.dataUpdatedAt,
      }))
    try {
      storage()?.setItem(storageKey, JSON.stringify(entries))
    } catch {
      // Storage full or blocked: the app still works online.
    }
  }
  return queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type === "updated" &&
      event.action.type === "success" &&
      kept(event.query.queryKey)
    )
      timer ??= window.setTimeout(save, 500)
  })
}
