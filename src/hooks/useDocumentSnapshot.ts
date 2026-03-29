// src/hooks/useDocumentSnapshot.ts
// ─────────────────────────────────────────────────────────────────────────────
// Fetches the initial Yjs document state from GET /documents/:id/snapshot.
//
// Response shape:
//   document_id  string   — echoes back the requested ID
//   snapshot     string   — base64-encoded Yjs binary state vector
//                           empty string ("") for brand-new documents
//   clock        number   — the server's current update clock for this document
//
// The snapshot is applied to the Y.Doc before the WebSocket opens so the
// editor renders immediately with the last-known content, then the
// WebsocketProvider's sync handshake fills in any updates the server has
// received since the snapshot was compacted.
//
// Design decisions:
//   - enabled: requires both documentId and tokenReady to be truthy.
//     We wait for the document token fetch to succeed before fetching the
//     snapshot — both are needed before the WebSocket can open, and this
//     ordering avoids a race where the snapshot arrives but the token 403s.
//   - staleTime: Infinity: snapshots are bootstrapped once per editor session.
//     After that, the Yjs CRDT is the source of truth — re-fetching the
//     snapshot would reset the in-memory Y.Doc, which is wrong.
//   - gcTime: 0: same rationale as useDocumentToken — discard on unmount.
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { DocumentSnapshotResponse } from '@/lib/types'

export const documentSnapshotQueryKey = (documentId: string) =>
  ['documents', documentId, 'snapshot'] as const

interface Options {
  documentId: string | undefined
  // Only fetch the snapshot once the document token is in hand.
  // The editor needs both before it can initialise the WebSocket provider.
  tokenReady: boolean
}

export function useDocumentSnapshot({ documentId, tokenReady }: Options) {
  return useQuery<DocumentSnapshotResponse>({
    queryKey: documentSnapshotQueryKey(documentId ?? ''),
    queryFn: () =>
      api
        .get<DocumentSnapshotResponse>(ROUTES.documents.snapshot(documentId!))
        .then((r) => r.data),
    enabled: Boolean(documentId) && tokenReady,
    // Snapshot is the bootstrap state — never re-fetch while editor is open
    staleTime: Infinity,
    // Discard on unmount — a stale snapshot from a previous session is wrong
    gcTime: 0,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 403 || status === 401 || status === 404) return false
      return failureCount < 2
    },
  })
}