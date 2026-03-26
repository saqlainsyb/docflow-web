// src/hooks/useWorkspace.ts
// ─────────────────────────────────────────────────────────────────────────────
// Query hook for GET /workspaces/:id — returns workspace detail including
// the full members array.
//
// Used by:
//   - UserMenu       (derives current user's role from members array)
//   - MembersPage    (renders the members table)
//   - SettingsPage   (renders the workspace name + delete zone)
//
// Query key: ['workspaces', id]
//   The list key ['workspaces'] is a prefix of this key. Invalidating
//   ['workspaces'] cascades to all detail queries automatically.
//   Mutation hooks can also target this key directly for surgical updates.
//
// enabled: false when id is undefined — prevents the query from firing on
//   routes where workspaceId is not in the URL (e.g. /profile).
//   The hook returns { data: undefined, isLoading: false } in that case,
//   which all consumers handle via optional chaining.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { WorkspaceDetail } from '@/lib/types'

export const workspaceQueryKey = (id: string) => ['workspaces', id] as const

export function useWorkspace(id: string | undefined) {
  return useQuery({
    queryKey: workspaceQueryKey(id ?? ''),
    queryFn: () =>
      api
        .get<WorkspaceDetail>(ROUTES.workspaces.detail(id!))
        .then((res) => res.data),
    // Do not fire when id is absent — consumers receive undefined data cleanly
    enabled: !!id,
  })
}