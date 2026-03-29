// src/hooks/useBoardWebSocket.ts
// ─────────────────────────────────────────────────────────────────────────────
// Manages the full lifecycle of the board WebSocket connection.
//
// Responsibilities:
//   1. Opens WS /ws/boards/:boardId?token=<accessToken>
//   2. Maintains connection status in the Redux `ws` slice so any component
//      can display a connectivity indicator.
//   3. Applies every incoming board event directly to the TanStack Query cache
//      for boardQueryKey(boardId) — no HTTP re-fetch needed.
//   4. Reconnects automatically with exponential back-off (1s → 30s cap).
//   5. Cleans up on unmount: closes the socket, clears the Redux status key.
//
// Called once at the top of BoardPage. Returns nothing — pure side effect.
//
// Bug fixed (refresh race):
//   The effect now depends on [boardId, accessToken]. On a fresh page load,
//   accessToken starts as null while useAuthBootstrap rehydrates from the
//   refresh-token cookie. The previous version depended only on [boardId],
//   so connect() would fire immediately with a null token and bail out silently,
//   leaving the socket permanently unopened after a refresh.
//
//   To avoid spurious reconnects when the Axios interceptor rotates the access
//   token mid-session, connect() checks whether a healthy socket already exists
//   (OPEN or CONNECTING) and skips re-connecting if so. A token rotation alone
//   will not cause an unnecessary teardown.
//
// Event → cache update map:
//   CARD_CREATED     → append card to target column's cards array
//   CARD_UPDATED     → patch matching card fields in place
//   CARD_MOVED       → remove card from source column, insert at computed index
//   CARD_ARCHIVED    → remove card from all columns
//   CARD_UNARCHIVED  → re-append card to its column (backend sends full card)
//   CARD_DELETED     → remove card from all columns
//   COLUMN_CREATED   → append column (with empty cards) to columns array
//   COLUMN_RENAMED   → patch title in matching column
//   COLUMN_REORDERED → patch position + re-sort columns array
//   COLUMN_DELETED   → remove column + all its cards from state
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { setBoardStatus, clearBoardStatus } from '@/store'
import { boardQueryKey } from '@/hooks/useBoard'
import type {
  BoardDetailResponse,
  CardResponse,
  ColumnWithCards,
} from '@/lib/types'

// ── Event payload shapes ───────────────────────────────────────────────────────

type BoardEvent =
  | { type: 'CARD_CREATED'; card: CardResponse }
  | { type: 'CARD_UPDATED'; card_id: string; changes: Partial<CardResponse> }
  | { type: 'CARD_MOVED'; card_id: string; column_id: string; position: number }
  | { type: 'CARD_ARCHIVED'; card_id: string }
  | { type: 'CARD_UNARCHIVED'; card: CardResponse }
  | { type: 'CARD_DELETED'; card_id: string }
  | { type: 'COLUMN_CREATED'; column: ColumnWithCards }
  | { type: 'COLUMN_RENAMED'; column_id: string; title: string }
  | { type: 'COLUMN_REORDERED'; column_id: string; position: number }
  | { type: 'COLUMN_DELETED'; column_id: string }

// ── Reconnect timing ──────────────────────────────────────────────────────────

const BACKOFF_BASE_MS = 1_000
const BACKOFF_MAX_MS = 30_000

function nextBackoff(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS)
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

type BoardUpdater = (prev: BoardDetailResponse) => BoardDetailResponse

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBoardWebSocket(boardId: string | undefined): void {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const accessToken = useAppSelector((s) => s.auth.accessToken)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const unmountedRef = useRef(false)

  // ── Cache updater ─────────────────────────────────────────────────────────

  const updateCache = useCallback(
    (boardId: string, updater: BoardUpdater) => {
      queryClient.setQueryData<BoardDetailResponse>(boardQueryKey(boardId), (prev) => {
        if (!prev) return prev
        return updater(prev)
      })
    },
    [queryClient],
  )

  // ── Event handler ─────────────────────────────────────────────────────────

  const handleEvent = useCallback(
    (event: BoardEvent, currentBoardId: string) => {
      updateCache(currentBoardId, (prev) => {
        switch (event.type) {
          case 'CARD_CREATED': {
            // Idempotency guard: the creating browser already has this card in
            // cache from the mutation's invalidation re-fetch. Appending again
            // would produce a visible duplicate. Skip if any column already
            // contains a card with this id.
            const alreadyExists = prev.columns.some((col) =>
              col.cards.some((c) => c.id === event.card.id),
            )
            if (alreadyExists) return prev

            return {
              ...prev,
              columns: prev.columns.map((col) =>
                col.id === event.card.column_id
                  ? {
                      ...col,
                      cards: [...col.cards, event.card].sort(
                        (a, b) => a.position - b.position,
                      ),
                    }
                  : col,
              ),
            }
          }

          case 'CARD_UPDATED': {
            return {
              ...prev,
              columns: prev.columns.map((col) => ({
                ...col,
                cards: col.cards.map((card) =>
                  card.id === event.card_id
                    ? { ...card, ...event.changes }
                    : card,
                ),
              })),
            }
          }

          case 'CARD_MOVED': {
            let movedCard: CardResponse | undefined

            const columnsWithout = prev.columns.map((col) => {
              const filtered = col.cards.filter((c) => {
                if (c.id === event.card_id) {
                  movedCard = c
                  return false
                }
                return true
              })
              return { ...col, cards: filtered }
            })

            if (!movedCard) return prev

            const updatedCard: CardResponse = {
              ...movedCard,
              column_id: event.column_id,
              position: event.position,
            }

            return {
              ...prev,
              columns: columnsWithout.map((col) =>
                col.id === event.column_id
                  ? {
                      ...col,
                      cards: [...col.cards, updatedCard].sort(
                        (a, b) => a.position - b.position,
                      ),
                    }
                  : col,
              ),
            }
          }

          case 'CARD_ARCHIVED': {
            return {
              ...prev,
              columns: prev.columns.map((col) => ({
                ...col,
                cards: col.cards.filter((c) => c.id !== event.card_id),
              })),
            }
          }

          case 'CARD_UNARCHIVED': {
            return {
              ...prev,
              columns: prev.columns.map((col) =>
                col.id === event.card.column_id
                  ? {
                      ...col,
                      cards: [...col.cards, event.card].sort(
                        (a, b) => a.position - b.position,
                      ),
                    }
                  : col,
              ),
            }
          }

          case 'CARD_DELETED': {
            return {
              ...prev,
              columns: prev.columns.map((col) => ({
                ...col,
                cards: col.cards.filter((c) => c.id !== event.card_id),
              })),
            }
          }

          case 'COLUMN_CREATED': {
            // Idempotency guard: same as CARD_CREATED — the creating browser
            // already has this column from the invalidation re-fetch.
            const columnExists = prev.columns.some((col) => col.id === event.column.id)
            if (columnExists) return prev

            const newColumn: ColumnWithCards = {
              ...event.column,
              cards: event.column.cards ?? [],
            }
            return {
              ...prev,
              columns: [...prev.columns, newColumn].sort(
                (a, b) => a.position - b.position,
              ),
            }
          }

          case 'COLUMN_RENAMED': {
            return {
              ...prev,
              columns: prev.columns.map((col) =>
                col.id === event.column_id
                  ? { ...col, title: event.title }
                  : col,
              ),
            }
          }

          case 'COLUMN_REORDERED': {
            return {
              ...prev,
              columns: prev.columns
                .map((col) =>
                  col.id === event.column_id
                    ? { ...col, position: event.position }
                    : col,
                )
                .sort((a, b) => a.position - b.position),
            }
          }

          case 'COLUMN_DELETED': {
            return {
              ...prev,
              columns: prev.columns.filter((col) => col.id !== event.column_id),
            }
          }

          default:
            return prev
        }
      })
    },
    [updateCache],
  )

  // ── Effect: open socket when boardId and accessToken are both available ────
  //
  // Depends on [boardId, accessToken] so the socket opens correctly after a
  // page refresh — on fresh mount, accessToken is null until useAuthBootstrap
  // completes the silent refresh, so the previous [boardId]-only dependency
  // caused a permanent miss: connect() fired with no token and never retried.
  //
  // To prevent a token rotation mid-session from tearing down a healthy socket,
  // connect() checks readyState first and skips if OPEN or CONNECTING.

  useEffect(() => {
    if (!boardId || !accessToken) return

    unmountedRef.current = false

    // If a healthy socket already exists (e.g. accessToken just rotated via
    // silent refresh), do not tear down and re-open — just leave it alone.
    const existingState = wsRef.current?.readyState
    if (
      existingState === WebSocket.OPEN ||
      existingState === WebSocket.CONNECTING
    ) {
      return
    }

    // Cancel any pending backoff timer before opening a fresh socket so we
    // don't end up with two sockets racing to connect.
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    // connect is defined inside the effect so it always closes over the exact
    // boardId and accessToken values from this render cycle — no stale refs.
    function connect(currentBoardId: string, token: string) {
      if (unmountedRef.current) return

      dispatch(setBoardStatus({ boardId: currentBoardId, status: 'connecting' }))

      const wsUrl = `${import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080'}/ws/boards/${currentBoardId}?token=${token}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (unmountedRef.current) {
          ws.close()
          return
        }
        attemptRef.current = 0
        dispatch(setBoardStatus({ boardId: currentBoardId, status: 'connected' }))
      }

      ws.onmessage = (evt) => {
        if (typeof evt.data !== 'string') return
        try {
          const event = JSON.parse(evt.data) as BoardEvent
          handleEvent(event, currentBoardId)
        } catch {
          // Malformed JSON — ignore silently
        }
      }

      ws.onerror = () => {
        if (!unmountedRef.current) {
          dispatch(setBoardStatus({ boardId: currentBoardId, status: 'reconnecting' }))
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        if (unmountedRef.current) return

        dispatch(setBoardStatus({ boardId: currentBoardId, status: 'reconnecting' }))

        const delay = nextBackoff(attemptRef.current)
        attemptRef.current += 1

        reconnectTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current) connect(currentBoardId, token)
        }, delay)
      }
    }

    connect(boardId, accessToken)

    return () => {
      unmountedRef.current = true

      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      dispatch(clearBoardStatus(boardId))
    }
  }, [boardId, accessToken, dispatch, handleEvent])
}