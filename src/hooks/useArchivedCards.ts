// src/hooks/useArchivedCards.ts
// ─────────────────────────────────────────────────────────────────────────────
// Query hook for GET /api/v1/boards/:id/archived-cards
//
// Design decisions:
//   - `enabled` is controlled by the caller (the drawer passes its open state).
//     This means we never fetch unless the drawer is actually open — no wasted
//     requests on every board page mount.
//   - staleTime is 0 — archived cards change rarely but we always want a fresh
//     list when the drawer opens (user may have just archived something).
//   - The query key includes 'archived' as a third segment so it lives next to
//     the board detail query ['boards', boardId] without colliding with it.
//   - On unarchive success, useUnarchiveCard invalidates ['boards', boardId]
//     (the live board). We also need to invalidate this query so the drawer
//     removes the restored card. The invalidation is handled in useUnarchiveCard
//     via the queryKey export from this file.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { ArchivedCardResponse } from '@/lib/types'

// Exported so useUnarchiveCard can invalidate both query keys together.
export function archivedCardsQueryKey(boardId: string) {
  return ['boards', boardId, 'archived'] as const
}

export function useArchivedCards(boardId: string, enabled: boolean) {
  return useQuery<ArchivedCardResponse[]>({
    queryKey: archivedCardsQueryKey(boardId),
    queryFn: () =>
      api
        .get<ArchivedCardResponse[]>(ROUTES.boards.archivedCards(boardId))
        .then((res) => res.data),
    enabled: enabled && !!boardId,
    // Always refetch when the drawer opens so the list is never stale.
    staleTime: 0,
  })
}