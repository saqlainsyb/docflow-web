// src/hooks/useDeleteBoard.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspaceBoardsQueryKey } from '@/hooks/useWorkspaceBoards'

export function useDeleteBoard(boardId: string, workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      api.delete(ROUTES.boards.delete(boardId)).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceBoardsQueryKey(workspaceId),
      })
      toast.success('Board deleted')
    },
    onError: () => {
      toast.error('Failed to delete board')
    },
  })
}