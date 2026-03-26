// src/hooks/useRenameWorkspace.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for PATCH /workspaces/:id.
//
// Responsibilities:
// 1. PATCH the new workspace name
// 2. On success: invalidate both the list and detail queries so the
//    sidebar WorkspaceSwitcher and the page heading update immediately
//
// Cache strategy:
//   Invalidate ['workspaces'] — cascades to both the list query and
//   all detail queries (since detail keys are prefixed with 'workspaces').
//   One invalidation call covers both.
//
// Backend error codes to handle at the callsite:
//   VALIDATION_ERROR         → 400 — name too long or empty after trim
//   INSUFFICIENT_PERMISSIONS → 403 — caller is not admin or owner
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspacesQueryKey } from '@/hooks/useWorkspaces'
import type { WorkspaceListItem } from '@/lib/types'
import type { RenameWorkspaceFormValues } from '@/lib/validations'

export function useRenameWorkspace(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: RenameWorkspaceFormValues) =>
      api
        .patch<WorkspaceListItem>(ROUTES.workspaces.update(workspaceId), values)
        .then((res) => res.data),

    onSuccess: () => {
      // Invalidate the list prefix — cascades to detail queries too
      queryClient.invalidateQueries({ queryKey: workspacesQueryKey })
    },
  })
}