import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  categorySchema,
  modifierGroupSchema,
  productSchema,
  type CategoryForm,
  type ModifierGroupForm,
  type ProductForm,
  type ProductKind,
} from "@/features/catalog/schemas/catalog.ts"
import { api } from "@/lib/api.ts"

export const catalogKeys = {
  all: ["catalog"] as const,
  categories: () => [...catalogKeys.all, "categories"] as const,
  products: (kind: ProductKind) =>
    [...catalogKeys.all, "products", kind] as const,
  modifierGroups: () => [...catalogKeys.all, "modifier-groups"] as const,
}

// The catalog changes a few times a day at most; tablets keep it for minutes.
const CATALOG_STALE = 5 * 60_000

export function useCategoriesQuery() {
  return useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>(
        "/catalog/categories/",
        { signal }
      )
      return z.array(categorySchema).parse(data.data)
    },
    staleTime: CATALOG_STALE,
  })
}

export function useProductsQuery(kind: ProductKind) {
  return useQuery({
    queryKey: catalogKeys.products(kind),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>("/catalog/products/", {
        params: { kind },
        signal,
      })
      return z.array(productSchema).parse(data.data)
    },
    staleTime: CATALOG_STALE,
  })
}

export function useModifierGroupsQuery() {
  return useQuery({
    queryKey: catalogKeys.modifierGroups(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<{ data: unknown }>(
        "/catalog/modifier-groups/",
        { signal }
      )
      return z.array(modifierGroupSchema).parse(data.data)
    },
    staleTime: CATALOG_STALE,
  })
}

/** Every catalog change can move counts and names shown elsewhere, so the whole catalog refreshes. */
function useCatalogMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  silent = true
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
    meta: { silent },
  })
}

export function useSaveCategory() {
  return useCatalogMutation(
    async ({ id, form }: { id?: string; form: CategoryForm }) => {
      const { data } = id
        ? await api.patch<{ data: unknown }>(`/catalog/categories/${id}/`, form)
        : await api.post<{ data: unknown }>("/catalog/categories/", form)
      return categorySchema.parse(data.data)
    }
  )
}

export function useDeleteCategory() {
  return useCatalogMutation(
    (id: string) => api.delete(`/catalog/categories/${id}/`),
    false
  )
}

export function useReorderCategories() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post("/catalog/categories/reorder/", { ids }),
    // Show the new order at once; the server's answer replaces it.
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: catalogKeys.categories() })
      const previous = queryClient.getQueryData<
        z.infer<typeof categorySchema>[]
      >(catalogKeys.categories())
      if (previous)
        queryClient.setQueryData(
          catalogKeys.categories(),
          ids.flatMap((id, index) => {
            const row = previous.find((category) => category.id === id)
            return row ? [{ ...row, sort_order: index }] : []
          })
        )
      return { previous }
    },
    onError: (_error, _ids, context) => {
      if (context?.previous)
        queryClient.setQueryData(catalogKeys.categories(), context.previous)
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: catalogKeys.categories() }),
  })
}

/** Blank barcode means "none"; ingredients carry no category, price or modifiers. */
function productPayload(form: Partial<ProductForm>) {
  return { ...form, barcode: form.barcode?.trim() || null }
}

export function useSaveProduct() {
  return useCatalogMutation(
    async ({ id, form }: { id?: string; form: Partial<ProductForm> }) => {
      const { data } = id
        ? await api.patch<{ data: unknown }>(
            `/catalog/products/${id}/`,
            productPayload(form)
          )
        : await api.post<{ data: unknown }>(
            "/catalog/products/",
            productPayload(form)
          )
      return productSchema.parse(data.data)
    }
  )
}

/** Sold-out toggle from the grid: one field, optimistic. */
export function useSetAvailable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      is_available,
    }: {
      id: string
      kind: ProductKind
      is_available: boolean
    }) => api.patch(`/catalog/products/${id}/`, { is_available }),
    onMutate: async ({ id, kind, is_available }) => {
      const key = catalogKeys.products(kind)
      await queryClient.cancelQueries({ queryKey: key })
      const previous =
        queryClient.getQueryData<z.infer<typeof productSchema>[]>(key)
      queryClient.setQueryData(
        key,
        previous?.map((p) => (p.id === id ? { ...p, is_available } : p))
      )
      return { previous, key }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSettled: (_data, _error, vars) =>
      queryClient.invalidateQueries({
        queryKey: catalogKeys.products(vars.kind),
      }),
  })
}

export function useArchiveProduct() {
  return useCatalogMutation(
    (id: string) => api.delete(`/catalog/products/${id}/`),
    false
  )
}

export function useUploadProductImage() {
  return useCatalogMutation(
    async ({ id, file }: { id: string; file: File }) => {
      const body = new FormData()
      body.append("image", file)
      const { data } = await api.post<{ data: unknown }>(
        `/catalog/products/${id}/image/`,
        body,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      )
      return productSchema.parse(data.data)
    }
  )
}

export function useSaveModifierGroup() {
  return useCatalogMutation(
    async ({ id, form }: { id?: string; form: ModifierGroupForm }) => {
      const { data } = id
        ? await api.patch<{ data: unknown }>(
            `/catalog/modifier-groups/${id}/`,
            form
          )
        : await api.post<{ data: unknown }>("/catalog/modifier-groups/", form)
      return modifierGroupSchema.parse(data.data)
    }
  )
}

export function useDeleteModifierGroup() {
  return useCatalogMutation(
    (id: string) => api.delete(`/catalog/modifier-groups/${id}/`),
    false
  )
}
