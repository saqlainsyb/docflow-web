// src/pages/workspace/BoardPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The kanban board view. Owns the DnD context and all drag/drop logic.
//
// Layout:
//   Fixed topbar (back, title, members, share)
//   Horizontally-scrolling board area (columns + "New Column" button)
//
// DnD architecture:
//   DndContext          — lives here, handles onDragStart/Over/End
//   SortableContext     — one per column with verticalListSortingStrategy
//   useSortable         — on each Card
//
// Drag lifecycle:
//   onDragStart  → record active card id + source column id
//   onDragOver   → if container changed, optimistically move card in local
//                  state so the column highlights correctly during drag
//   onDragEnd    → compute fractional position, call useMoveCard,
//                  clear active state
//
// Position computation (fractional.ts):
//   After drop we have the sorted cards array of the target column.
//   We find where the dragged card landed (by overId) and compute:
//     - before first:  before(cards[0].position)
//     - between:       between(cards[prev].position, cards[next].position)
//     - after last:    after(cards[last].position)
//   If needsRebalance() → rebalance all cards in that column via PATCH.
//
// Sub-components (page-scoped):
//   BoardTopbar   — back nav, title, member avatars, share/more buttons
//
// Module 6 addition:
//   useBoardWebSocket(boardId) — opens WS /ws/boards/:boardId and applies
//   real-time card/column events directly to the TanStack Query cache.
//   No UI changes required — the cache update flows through to columns → render.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, Share2, MoreHorizontal, Loader2, Plus } from 'lucide-react'
import { useAppDispatch } from '@/store/hooks'
import { openModal } from '@/store'
import { useBoard } from '@/hooks/useBoard'
import { useMoveCard } from '@/hooks/useMoveCard'
import { useBoardWebSocket } from '@/hooks/useBoardWebSocket'
import { Column } from '@/components/board/Column'
import { Card } from '@/components/board/Card'
import { between, before, after, needsRebalance, rebalance } from '@/lib/fractional'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { BoardDetailResponse, CardResponse, ColumnWithCards } from '@/lib/types'

// ── BoardTopbar ───────────────────────────────────────────────────────────────

interface BoardTopbarProps {
  board: BoardDetailResponse
  onBack: () => void
}

function BoardTopbar({ board, onBack }: BoardTopbarProps) {
  // Show up to 3 avatars, then overflow count
  const visibleMembers = board.members.slice(0, 3)
  const overflowCount = board.members.length - visibleMembers.length

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-surface-container-low border-b border-outline-variant/10 z-40 shrink-0">
      {/* Left — back + title */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onBack}
          aria-label="Back to boards"
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
            'text-on-surface-variant hover:bg-surface-container-highest',
            'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display font-bold text-xl tracking-tight text-on-surface truncate hover:text-primary transition-colors cursor-default">
              {board.title}
            </h1>
            <span
              className={cn(
                'shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                'bg-surface-container-highest text-on-surface-variant',
              )}
            >
              {board.visibility}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant/60 font-medium">
            {board.columns.reduce((acc, col) => acc + col.cards.length, 0)} cards across {board.columns.length} columns
          </p>
        </div>
      </div>

      {/* Right — member avatars + actions */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Member avatars */}
        {visibleMembers.length > 0 && (
          <div className="flex items-center">
            <div className="flex -space-x-3">
              {visibleMembers.map((member) => (
                <div
                  key={member.user_id}
                  title={member.name}
                  className={cn(
                    'w-9 h-9 rounded-full border-2 border-surface-container-low',
                    'bg-df-tertiary-container text-df-on-tertiary-container',
                    'flex items-center justify-center text-[10px] font-bold select-none',
                    'shrink-0',
                  )}
                >
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(member.name)
                  )}
                </div>
              ))}
            </div>
            {overflowCount > 0 && (
              <div className="ml-2 px-2.5 py-1 bg-surface-container-highest rounded-full text-[11px] font-bold text-secondary">
                +{overflowCount}
              </div>
            )}
          </div>
        )}

        <div className="h-6 w-px bg-outline-variant/20" />

        {/* Share button */}
        <button
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold',
            'border border-outline-variant/20 text-on-surface',
            'hover:bg-surface-container-highest transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>

        {/* More button */}
        <button
          className={cn(
            'w-10 h-10 flex items-center justify-center rounded-lg',
            'bg-surface-container-highest text-on-surface',
            'hover:brightness-110 transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
          aria-label="Board options"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}

// ── BoardPage ─────────────────────────────────────────────────────────────────

export function BoardPage() {
  const { workspaceId, boardId } = useParams<{ workspaceId: string; boardId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const { data: board, isLoading, isError } = useBoard(boardId)
  const { mutate: moveCard } = useMoveCard(boardId ?? '')

  // Module 6: open the board WebSocket and keep it alive for the lifetime of
  // this page. All real-time events are applied to the TanStack Query cache
  // inside the hook — no local state wiring required here.
  useBoardWebSocket(boardId)

  // Local column state — mirrors the board query but allows optimistic
  // cross-column reordering during an active drag without mutating the cache.
  const [localColumns, setLocalColumns] = useState<ColumnWithCards[] | null>(null)
  const [activeCard, setActiveCard] = useState<CardResponse | null>(null)

  // The columns we actually render: local override during drag, server data otherwise
  const columns = localColumns ?? board?.columns ?? []

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 8px movement before drag starts — prevents accidental drags on click
      activationConstraint: { distance: 8 },
    }),
  )

  // ── Drag handlers ───────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const card = board?.columns
      .flatMap((col) => col.cards)
      .find((c) => c.id === event.active.id)
    if (card) {
      setActiveCard(card)
      // Seed local columns from server data at drag start
      setLocalColumns(board?.columns ?? null)
    }
  }, [board])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setLocalColumns((prev) => {
      if (!prev) return prev

      const activeCardId = active.id as string
      const overId = over.id as string

      // Find source column
      const sourceCol = prev.find((col) =>
        col.cards.some((c) => c.id === activeCardId),
      )
      // over.id can be a column id or a card id — resolve to column
      const targetCol =
        prev.find((col) => col.id === overId) ??
        prev.find((col) => col.cards.some((c) => c.id === overId))

      if (!sourceCol || !targetCol || sourceCol.id === targetCol.id) return prev

      const movingCard = sourceCol.cards.find((c) => c.id === activeCardId)!
      const overCardIndex = targetCol.cards.findIndex((c) => c.id === overId)
      const insertIndex = overCardIndex >= 0 ? overCardIndex : targetCol.cards.length

      return prev.map((col) => {
        if (col.id === sourceCol.id) {
          return { ...col, cards: col.cards.filter((c) => c.id !== activeCardId) }
        }
        if (col.id === targetCol.id) {
          const newCards = [...col.cards]
          newCards.splice(insertIndex, 0, { ...movingCard, column_id: targetCol.id })
          return { ...col, cards: newCards }
        }
        return col
      })
    })
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)

    if (!over || !localColumns) {
      setLocalColumns(null)
      return
    }

    const activeCardId = active.id as string
    const overId = over.id as string

    // Find target column (over could be column id or card id)
    const targetCol =
      localColumns.find((col) => col.id === overId) ??
      localColumns.find((col) => col.cards.some((c) => c.id === overId))

    if (!targetCol) {
      setLocalColumns(null)
      return
    }

    // Current card array in target column after drag-over reordering
    let targetCards = targetCol.cards

    // Handle same-column reorder
    const sourceColBeforeDrag = board?.columns.find((col) =>
      col.cards.some((c) => c.id === activeCardId),
    )
    if (sourceColBeforeDrag?.id === targetCol.id) {
      const oldIndex = sourceColBeforeDrag.cards.findIndex((c) => c.id === activeCardId)
      const newIndex = targetCards.findIndex((c) => c.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        targetCards = arrayMove(targetCards, oldIndex, newIndex)
      }
    }

    // Compute fractional position for the dropped card
    const droppedIndex = targetCards.findIndex((c) => c.id === activeCardId)
    const prevCard = targetCards[droppedIndex - 1]
    const nextCard = targetCards[droppedIndex + 1]

    let newPosition: number
    if (!prevCard && !nextCard) {
      newPosition = 1000
    } else if (!prevCard) {
      newPosition = before(nextCard.position)
    } else if (!nextCard) {
      newPosition = after(prevCard.position)
    } else {
      newPosition = between(prevCard.position, nextCard.position)
    }

    // Check if remaining cards in target column need rebalancing
    const sortedPositions = targetCards
      .filter((c) => c.id !== activeCardId)
      .map((c) => c.position)
      .sort((a, b) => a - b)

    if (needsRebalance(sortedPositions)) {
      // Rebalance: reassign 1000, 2000, 3000… to all cards in column
      const rebalanced = rebalance(targetCards.length)
      targetCards.forEach((card, i) => {
        if (card.id !== activeCardId) {
          moveCard({
            cardId: card.id,
            column_id: targetCol.id,
            position: rebalanced[i],
          })
        }
      })
      newPosition = rebalanced[droppedIndex]
    }

    moveCard({
      cardId: activeCardId,
      column_id: targetCol.id,
      position: newPosition,
    })

    setLocalColumns(null)
  }, [localColumns, board, moveCard])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-outline" />
      </div>
    )
  }

  if (isError || !board) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <p className="text-on-surface-variant text-sm">
          Board not found or you don't have access.
        </p>
        <button
          onClick={() => navigate(`/${workspaceId}/boards`)}
          className="text-primary text-sm hover:underline"
        >
          Back to boards
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <BoardTopbar
        board={board}
        onBack={() => navigate(`/${workspaceId}/boards`)}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Board canvas — horizontal scroll */}
        <main className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-6 p-8 h-full items-start min-w-max">
            {columns.map((column) => (
              <SortableContext
                key={column.id}
                items={column.cards.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <Column
                  column={column}
                  boardId={boardId ?? ''}
                  onAddCard={() =>
                    dispatch(openModal({ type: 'createCard', columnId: column.id }))
                  }
                  onAddColumn={() =>
                    dispatch(openModal({ type: 'createColumn', boardId: boardId ?? '' }))
                  }
                />
              </SortableContext>
            ))}

            {/* New Column button */}
            <button
              onClick={() =>
                dispatch(openModal({ type: 'createColumn', boardId: boardId ?? '' }))
              }
              className={cn(
                'shrink-0 w-80 h-full min-h-48 flex flex-col items-center justify-center gap-4',
                'rounded-2xl border-2 border-dashed border-outline-variant/10',
                'hover:border-primary/20 hover:bg-surface-container-low/50',
                'transition-all text-on-surface-variant hover:text-primary',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold uppercase tracking-wider">
                New Column
              </span>
            </button>
          </div>
        </main>

        {/* Drag overlay — renders the card being dragged above everything */}
        <DragOverlay>
          {activeCard ? (
            <Card
              card={activeCard}
              boardId={boardId ?? ''}
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}