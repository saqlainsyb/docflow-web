// src/hooks/useWorkspaceBoards.ts
// ─────────────────────────────────────────────────────────────────────────────
// Query hook for GET /workspaces/:id/boards.
//
// Returns all boards in the workspace visible to the current user:
//   - 'workspace' visibility  → all workspace members see it
//   - 'private' visibility    → only explicit board members see it
//
// The backend filters visibility server-side — we just render what we get.
//
// Sorting:
//   Boards are sorted newest-first (created_at desc) on the client.
//   The backend returns them in insertion order. Doing it here keeps the
//   hook consistent regardless of backend sort changes.
//
// Cache:
//   Key: ['workspaces', workspaceId, 'boards']
//   This nests under the workspace key so a workspace invalidation
//   (e.g. after delete) also busts the board list automatically.
//   staleTime: inherits the global 5-minute default from QueryClient.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { BoardListItem } from '@/lib/types'

// ── Query key factory ─────────────────────────────────────────────────────────
// Exported so mutations (useCreateBoard, useDeleteBoard) can invalidate
// this exact cache entry without importing the hook itself.

export const workspaceBoardsQueryKey = (workspaceId: string) =>
  ['workspaces', workspaceId, 'boards'] as const

export function useWorkspaceBoards(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceBoardsQueryKey(workspaceId ?? ''),

    queryFn: () =>
      api
        .get<BoardListItem[]>(ROUTES.workspaces.boards(workspaceId!))
        .then((res) => res.data),

    // Sort newest-first after fetch so the grid always shows the most
    // recently created board at the top-left. Using select keeps the
    // cached data in its original order — the sort is view-layer only.
    select: (data) =>
      [...data].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),

    // Don't fire until we have a real workspace ID
    enabled: Boolean(workspaceId),
  })
}