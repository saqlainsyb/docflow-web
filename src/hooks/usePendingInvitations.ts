// src/hooks/usePendingInvitations.ts
// ─────────────────────────────────────────────────────────────────────────────
// Query hook for GET /workspaces/:id/invitations.
// Returns all pending (non-expired) invitations for the workspace.
// Only admins and owners see this data — the backend enforces the gate.
//
// Stale time: 30 seconds. Invitations change infrequently — there's no need
// to refetch on every window focus. We rely on mutation-triggered invalidation
// (useSendInvitation, useCancelInvitation) to keep the list fresh.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { PendingInvitation } from '@/lib/types'
import { pendingInvitationsQueryKey } from '@/hooks/useSendInvitation'

export function usePendingInvitations(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: pendingInvitationsQueryKey(workspaceId),
    queryFn: () =>
      api
        .get<PendingInvitation[]>(`/workspaces/${workspaceId}/invitations`)
        .then((res) => res.data),
    enabled,
    staleTime: 30_000,
  })
}