import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import {
  staffPageSchema,
  staffSchema,
  type StaffForm,
} from "@/features/staff/schemas/staff.ts"
import { roleKeys } from "@/features/roles/api/roles.ts"
import { api } from "@/lib/api.ts"

export type StaffListParams = {
  search?: string
  active?: "true" | "false"
  page?: number
}

export const staffKeys = {
  all: ["staff"] as const,
  lists: () => [...staffKeys.all, "list"] as const,
  list: (params: StaffListParams) => [...staffKeys.lists(), params] as const,
}

export async function listStaff(params: StaffListParams, signal?: AbortSignal) {
  const { data } = await api.get("/staff/", {
    params: { ...params, page_size: 100 },
    signal,
  })
  return staffPageSchema.parse(data)
}

/** Only the fields the user filled are sent: a blank password means "unchanged". */
function payload(form: Partial<StaffForm>) {
  const body: Record<string, unknown> = { ...form }
  if (body.email === "") body.email = null
  if (!body.password) delete body.password
  return body
}

async function createStaff(form: StaffForm) {
  const { data } = await api.post<{ data: unknown }>("/staff/", payload(form))
  return staffSchema.parse(data.data)
}

async function updateStaff(id: number, form: Partial<StaffForm>) {
  const { data } = await api.patch<{ data: unknown }>(
    `/staff/${id}/`,
    payload(form)
  )
  return staffSchema.parse(data.data)
}

export function useStaffQuery(params: StaffListParams) {
  return useQuery({
    queryKey: staffKeys.list(params),
    queryFn: ({ signal }) => listStaff(params, signal),
    placeholderData: keepPreviousData,
  })
}

/** Any staff change can change how many staff each role has. */
function useInvalidateStaff() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: staffKeys.all }),
      queryClient.invalidateQueries({ queryKey: roleKeys.all }),
    ])
}

export function useSaveStaff() {
  const invalidate = useInvalidateStaff()
  return useMutation({
    mutationFn: ({ id, form }: { id?: number; form: StaffForm }) =>
      id ? updateStaff(id, form) : createStaff(form),
    onSuccess: invalidate,
    // The form shows field errors itself.
    meta: { silent: true },
  })
}

export function useSetActive() {
  const invalidate = useInvalidateStaff()
  return useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateStaff(id, { is_active }),
    onSuccess: invalidate,
  })
}
