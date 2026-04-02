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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { workspaceBoardsQueryKey } from "@/hooks/useWorkspaceBoards";
import type { BoardCreateResponse } from "@/lib/types";
import type { CreateBoardFormValues } from "@/lib/validations";
import { toast } from "sonner";

export function useCreateBoard(workspaceId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { workspaceId: workspaceIdFromParams } = useParams<{
    workspaceId: string;
  }>();

  return useMutation({
    mutationFn: (values: CreateBoardFormValues) =>
      api
        .post<BoardCreateResponse>(ROUTES.boards.create(workspaceId), values)
        .then((res) => res.data),

    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({
        queryKey: workspaceBoardsQueryKey(workspaceId),
      });

      toast.success("Board created", {
        description: `"${newBoard.Title}" is ready. Opening now…`,
      });

      const wsId = workspaceIdFromParams ?? workspaceId;
      // Backend returns PascalCase field names (no json tags on Board struct)
      navigate(`/${wsId}/boards/${newBoard.ID}`);
    },
    onError: () => {
      toast.error("Failed to create board", {
        description: "Something went wrong. Please try again.",
      });
    },
  });
}
