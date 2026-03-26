// src/hooks/useDeleteWorkspace.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for DELETE /workspaces/:id.
//
// Responsibilities:
// 1. DELETE the workspace — cascades everything on the backend
//    (boards, columns, cards, documents, members — all gone)
// 2. On success:
//    a. Invalidate ['workspaces'] so the list and switcher update
//    b. Remove ['workspaces', id] from the cache immediately —
//       no point refetching a workspace that no longer exists
//    c. Navigate to / — RootRedirect picks the next workspace or
//       shows the empty state if none remain
//
// This mutation is owner-only. The SettingsPage guards the UI,
// and the backend enforces it server-side.
//
// Backend error codes to handle at the callsite:
//   INSUFFICIENT_PERMISSIONS → 403 — not the owner
//   WORKSPACE_NOT_FOUND      → 404 — already deleted
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspacesQueryKey } from '@/hooks/useWorkspaces'
import { workspaceQueryKey } from '@/hooks/useWorkspace'

export function useDeleteWorkspace(workspaceId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () =>
      api
        .delete(ROUTES.workspaces.delete(workspaceId))
        .then((res) => res.data),

    onSuccess: () => {
      // Remove the detail cache entry immediately — it no longer exists
      queryClient.removeQueries({ queryKey: workspaceQueryKey(workspaceId) })
      // Invalidate the list so the switcher removes this workspace
      queryClient.invalidateQueries({ queryKey: workspacesQueryKey })
      // Navigate to root — RootRedirect handles picking the next workspace
      navigate('/', { replace: true })
    },
  })
}