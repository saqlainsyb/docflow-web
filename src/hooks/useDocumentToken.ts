// src/hooks/useDocumentToken.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fetches a short-lived document JWT from POST /documents/:id/token.
//
// The token is scoped to a single document ID and signed with
// JWT_DOCUMENT_SECRET (separate from the access token secret).
// The server also assigns a cursor color for this session, returned
// alongside the token so the Yjs awareness state can be pre-populated.
//
// Design decisions:
//   - useQuery, not useMutation: the token is derived from server state,
//     not an imperative action. We want caching + automatic re-use.
//   - staleTime: Infinity: the token is valid for 1 hour. We never need
//     a background re-fetch while the editor is open.
//   - gcTime: 0: discard the cached token the moment the editor unmounts.
//     A stale token from a previous session should never be used.
//   - enabled guard: only fires when documentId is a non-empty string,
//     preventing a spurious request during the loading state of the parent.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { DocumentTokenResponse } from '@/lib/types'

// Query key factory — co-located with the hook, not in useBoard.ts
export const documentTokenQueryKey = (documentId: string) =>
  ['documents', documentId, 'token'] as const

export function useDocumentToken(documentId: string | undefined) {
  return useQuery<DocumentTokenResponse>({
    queryKey: documentTokenQueryKey(documentId ?? ''),
    queryFn: () =>
      api
        .post<DocumentTokenResponse>(ROUTES.documents.token(documentId!))
        .then((r) => r.data),
    enabled: Boolean(documentId),
    // Token is good for 1 hour — never stale within a single editor session
    staleTime: Infinity,
    // Discard immediately on unmount so a stale token can't be reused
    gcTime: 0,
    // No retry on 403 — if the user lost board access, retrying won't help
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 403 || status === 401 || status === 404) return false
      return failureCount < 2
    },
  })
}