import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import {
  permissionSchema,
  roleSchema,
  type RoleForm,
} from "@/features/roles/schemas/role.ts"
import { api } from "@/lib/api.ts"

export const roleKeys = {
  all: ["roles"] as const,
  list: () => [...roleKeys.all, "list"] as const,
  permissions: () => [...roleKeys.all, "permissions"] as const,
}

export async function listRoles(signal?: AbortSignal) {
  const { data } = await api.get<{ data: unknown }>("/roles/", { signal })
  return z.array(roleSchema).parse(data.data)
}

export async function listPermissions(signal?: AbortSignal) {
  const { data } = await api.get<{ data: unknown }>("/permissions/", { signal })
  return z.array(permissionSchema).parse(data.data)
}

export function useRolesQuery() {
  return useQuery({
    queryKey: roleKeys.list(),
    queryFn: ({ signal }) => listRoles(signal),
  })
}

export function usePermissionsQuery() {
  return useQuery({
    queryKey: roleKeys.permissions(),
    queryFn: ({ signal }) => listPermissions(signal),
    // The catalog only changes with a deploy.
    staleTime: Infinity,
  })
}

export function useSaveRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      form,
    }: {
      id?: number
      form: Partial<RoleForm>
    }) => {
      const { data } = id
        ? await api.patch<{ data: unknown }>(`/roles/${id}/`, form)
        : await api.post<{ data: unknown }>("/roles/", form)
      return roleSchema.parse(data.data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
    meta: { silent: true },
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/roles/${id}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  })
}
