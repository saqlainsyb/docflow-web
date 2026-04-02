// src/hooks/useCreateWorkspace.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /workspaces.
//
// Responsibilities:
// 1. POST the workspace name to the backend
// 2. On success: invalidate the workspaces list so WorkspaceSwitcher
//    and RootRedirect see the new workspace immediately
// 3. Navigate to /:newWorkspaceId/boards so the user lands inside
//    their new workspace automatically
//
// Cache strategy:
//   Invalidate ['workspaces'] — the list query refetches and picks up
//   the new workspace. No optimistic update needed here: the workspace
//   ID isn't known until the server responds, so we can't navigate
//   optimistically anyway.
//
// onError intentionally absent — the component reads mutation.error
// and maps error codes to user-facing messages.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { workspacesQueryKey } from "@/hooks/useWorkspaces";
import type { WorkspaceListItem } from "@/lib/types";
import type { CreateWorkspaceFormValues } from "@/lib/validations";
import { toast } from "sonner";

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (values: CreateWorkspaceFormValues) =>
      api
        .post<WorkspaceListItem>(ROUTES.workspaces.create, values)
        .then((res) => res.data),

    onSuccess: (newWorkspace) => {
      // Invalidate the list so WorkspaceSwitcher reflects the new workspace
      queryClient.invalidateQueries({ queryKey: workspacesQueryKey });
      toast.success("Workspace created", {
        description: `"${newWorkspace.name}" is ready to go.`,
      });
      // Navigate into the new workspace immediately
      navigate(`/${newWorkspace.id}/boards`, { replace: false });
    },
    onError: () => {
      toast.error("Failed to create workspace", {
        description: "Something went wrong. Please try again.",
      });
    },
  });
}
