// src/hooks/useArchiveCard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hooks for POST /cards/:id/archive and POST /cards/:id/unarchive.
//
// Both live in one file — they're always used together and share identical
// structure. Splitting them would be artificial.
//
// Archive:
//   Invalidates ['boards', boardId] so the card disappears from the live board.
//   The WS CARD_ARCHIVED event also removes it from every other tab's cache
//   immediately — the invalidation is the local tab's confirmation.
//
// Unarchive:
//   Invalidates ['boards', boardId] so the card re-appears on the live board.
//   Also invalidates ['boards', boardId, 'archived'] so the archived cards
//   drawer removes the card immediately without waiting for the next open.
//   The WS CARD_UNARCHIVED event carries the full CardResponse so other tabs
//   update their caches in real time without a refetch.
//
// No optimistic updates — these are explicit, deliberate user actions.
// The brief loading state on the button is the right UX here.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'
import { archivedCardsQueryKey } from '@/hooks/useArchivedCards'

export function useArchiveCard(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cardId: string) =>
      api
        .post(ROUTES.cards.archive(cardId))
        .then((res) => res.data),

    onSuccess: () => {
      // Invalidate live board — card should disappear.
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
      // Invalidate archived list — card should appear if the drawer is open.
      queryClient.invalidateQueries({ queryKey: archivedCardsQueryKey(boardId) })
      toast.success('Card archived')
    },
    onError: () => {
      toast.error('Failed to archive card')
    },
  })
}

export function useUnarchiveCard(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cardId: string) =>
      api
        .post(ROUTES.cards.unarchive(cardId))
        .then((res) => res.data),

    onSuccess: () => {
      // Invalidate live board — card should re-appear in its column.
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
      // Invalidate archived list — card should disappear from the drawer.
      queryClient.invalidateQueries({ queryKey: archivedCardsQueryKey(boardId) })
      toast.success('Card restored')
    },
    onError: () => {
      toast.error('Failed to restore card')
    },
  })
}