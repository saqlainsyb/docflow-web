// src/components/board/Card.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A single kanban card. Uses useSortable for drag-and-drop.
//
// Visual states:
//   Normal     — surface-container-low bg, ghost border, color bar on left
//   Hover      — primary glow shadow, primary border tint, title → primary
//   Dragging   — opacity-0 (the card's slot stays visible as a ghost while
//                DragOverlay renders the actual card above everything)
//   Overlay    — isOverlay=true, rendered inside DragOverlay with full
//                opacity + slight scale + shadow for the "lifted" effect
//
// Color bar:
//   4px wide absolute bar on the left edge, color = card.color.
//   Hidden when card.color is null.
//
// Footer:
//   Assignee avatar (w-6 h-6) — shown when card.assignee is set
//   Doc icon — always shown (every card has a document_id)
//   Created date — formatted as "MMM D"
//
// Context menu (right-click or ⋯ button on hover):
//   Edit card — opens editCard modal
//   Archive   — calls useArchiveCard
//   Delete    — calls useDeleteCard with inline confirmation
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  MoreHorizontal, FileText, Pencil, Archive, Trash2, Loader2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAppDispatch } from '@/store/hooks'
import { openModal } from '@/store'
import { useArchiveCard } from '@/hooks/useArchiveCard'
import { useDeleteCard } from '@/hooks/useDeleteCard'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { CardResponse } from '@/lib/types'

interface CardProps {
  card: CardResponse
  boardId: string
  /** True when rendered inside DragOverlay — disables sortable, adds lifted style */
  isOverlay?: boolean
}

// Format ISO timestamp → "Oct 24" style
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function Card({ card, boardId, isOverlay = false }: CardProps) {
  const dispatch = useAppDispatch()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { mutate: archiveCard, isPending: isArchiving } = useArchiveCard(boardId)
  const { mutate: deleteCard, isPending: isDeleting } = useDeleteCard(boardId)

  // useSortable — disabled when rendering as DragOverlay clone
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    disabled: isOverlay,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'relative bg-surface-container-low rounded-xl p-5 cursor-grab active:cursor-grabbing',
        'border border-outline-variant/15',
        'transition-all duration-200 group',
        // Hover glow
        'hover:shadow-[0_0_15px_rgba(0,218,243,0.15)] hover:border-primary/30',
        // Ghost placeholder while dragging
        isDragging && !isOverlay && 'opacity-0',
        // Lifted state when in DragOverlay
        isOverlay && 'shadow-2xl scale-[1.02] rotate-1 cursor-grabbing opacity-95',
      )}
    >
      {/* ── Color bar ────────────────────────────────────────────────────── */}
      {card.color && (
        <div
          className="absolute left-0 top-4 bottom-4 w-1 rounded-r"
          style={{ backgroundColor: card.color }}
          aria-hidden="true"
        />
      )}

      {/* ── Card title ───────────────────────────────────────────────────── */}
      <h4 className="font-semibold text-sm text-on-surface leading-snug mb-4 pr-6 group-hover:text-primary transition-colors">
        {card.title}
      </h4>

      {/* ── Footer row ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Assignee avatar */}
          {card.assignee && (
            <div
              title={card.assignee.name}
              className={cn(
                'w-6 h-6 rounded-full shrink-0',
                'bg-df-tertiary-container text-df-on-tertiary-container',
                'flex items-center justify-center text-[9px] font-bold select-none',
              )}
            >
              {card.assignee.avatar_url ? (
                <img
                  src={card.assignee.avatar_url}
                  alt={card.assignee.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                getInitials(card.assignee.name)
              )}
            </div>
          )}

          {/* Doc icon — every card has a document */}
          <FileText
            className="w-3.5 h-3.5 text-on-surface-variant"
            aria-label="Has document"
          />
        </div>

        {/* Created date */}
        <span className="text-[10px] text-on-surface-variant font-medium">
          {formatDate(card.created_at)}
        </span>
      </div>

      {/* ── Options button (hover) ───────────────────────────────────────── */}
      {!isOverlay && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                // Stop the sortable drag listeners from firing on menu click
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Card options"
                className={cn(
                  'p-1 rounded-md text-on-surface-variant',
                  'hover:bg-surface-container-highest hover:text-on-surface',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  'data-[state=open]:opacity-100',
                )}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => dispatch(openModal({ type: 'editCard', cardId: card.id }))}
                className="gap-2 cursor-pointer"
              >
                <Pencil className="size-4 text-outline" />
                Edit card
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => archiveCard(card.id)}
                disabled={isArchiving}
                className="gap-2 cursor-pointer"
              >
                {isArchiving
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Archive className="size-4 text-outline" />
                }
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                className="gap-2 cursor-pointer"
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* ── Inline delete confirmation ───────────────────────────────────── */}
      {deleteOpen && (
        <div
          className={cn(
            'absolute inset-0 z-10 rounded-xl p-4',
            'bg-surface-container-highest/95 backdrop-blur-sm',
            'flex flex-col justify-between',
            'border border-destructive/20',
          )}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold text-on-surface">
            Delete this card?
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            This removes the card and its document permanently.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-bold',
                'border border-outline-variant/20 text-on-surface-variant',
                'hover:bg-surface-container hover:text-on-surface',
                'transition-colors disabled:opacity-50 disabled:pointer-events-none',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              Cancel
            </button>
            <button
              onClick={() => deleteCard(card.id, { onSuccess: () => setDeleteOpen(false) })}
              disabled={isDeleting}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-bold',
                'bg-destructive/10 text-destructive',
                'hover:bg-destructive hover:text-background',
                'flex items-center justify-center gap-1.5',
                'transition-colors disabled:opacity-40 disabled:pointer-events-none',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
              )}
            >
              {isDeleting
                ? <Loader2 className="size-3 animate-spin" />
                : 'Delete'
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}