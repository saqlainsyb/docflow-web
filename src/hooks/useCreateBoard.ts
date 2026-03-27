// src/hooks/useCreateBoard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /workspaces/:id/boards.
//
// On success:
//   1. Invalidate ['workspaces', workspaceId, 'boards'] so BoardsPage
//      immediately shows the new board without a manual refresh.
//   2. Navigate to /:workspaceId/boards/:newBoardId — the user lands
//      directly on the board they just created.
//
// onError is intentionally absent — the raw AxiosError lives on
// mutation.error and is read at the callsite (CreateBoardModal).
//
// Backend error codes to handle at the callsite:
//   VALIDATION_ERROR         → 400 — title empty or too long
//   INSUFFICIENT_PERMISSIONS → 403 — caller is not admin or owner
//   WORKSPACE_NOT_FOUND      → 404 — stale workspaceId
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspaceBoardsQueryKey } from '@/hooks/useWorkspaceBoards'
import type { BoardListItem } from '@/lib/types'
import type { CreateBoardFormValues } from '@/lib/validations'

export function useCreateBoard(workspaceId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { workspaceId: workspaceIdFromParams } = useParams<{ workspaceId: string }>()

  return useMutation({
    mutationFn: (values: CreateBoardFormValues) =>
      api
        .post<BoardListItem>(ROUTES.boards.create(workspaceId), values)
        .then((res) => res.data),

    onSuccess: (newBoard) => {
      // Invalidate the board list so BoardsPage reflects the new board
      queryClient.invalidateQueries({
        queryKey: workspaceBoardsQueryKey(workspaceId),
      })

      // Navigate to the new board — workspaceId from params is the
      // canonical source; fall back to the hook param if not in a
      // workspace route context (shouldn't happen, but safe)
      const wsId = workspaceIdFromParams ?? workspaceId
      navigate(`/${wsId}/boards/${newBoard.id}`)
    },
  })
}