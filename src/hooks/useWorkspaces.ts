// src/hooks/useWorkspaces.ts
// ─────────────────────────────────────────────────────────────────────────────
// Query hook for GET /workspaces — returns all workspaces the current user
// belongs to.
//
// Used by:
//   - WorkspaceSwitcher  (sidebar workspace list + active workspace name)
//   - RootRedirect       (App.tsx — resolves / → /:firstWorkspaceId/boards)
//
// Query key: ['workspaces']
//   Mutation hooks (useCreateWorkspace, useInviteMember etc.) invalidate this
//   key so the switcher list stays current without manual refetching.
//
// Stale time: inherits the global 5-minute default from QueryClient config.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { WorkspaceListItem } from '@/lib/types'

export const workspacesQueryKey = ['workspaces'] as const

export function useWorkspaces() {
  return useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () =>
      api
        .get<WorkspaceListItem[]>(ROUTES.workspaces.list)
        .then((res) => res.data),
  })
}