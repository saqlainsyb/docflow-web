// src/hooks/useDeleteBoard.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspaceBoardsQueryKey } from '@/hooks/useWorkspaceBoards'  // ← add this

export function useDeleteBoard(boardId: string, workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      api.delete(ROUTES.boards.delete(boardId)).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceBoardsQueryKey(workspaceId),
      })
    },
  })
}