// src/components/board/Column.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A single kanban column. Renders the frosted-glass column container,
// the header (title + card count + options menu), the scrollable card list,
// and the "Add Card" dashed button at the bottom.
//
// Receives its cards pre-sorted by position from BoardPage.
// Does not own any mutation logic — callbacks bubble up to BoardPage
// or are dispatched directly to the modal system.
//
// DnD: each Card inside uses useSortable. The SortableContext wrapper
// lives in BoardPage (one per column) — Column doesn't touch DnD directly.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { MoreHorizontal, Plus, Trash2, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useDeleteColumn } from '@/hooks/useDeleteColumn'
import { Card } from '@/components/board/Card'
import { cn } from '@/lib/utils'
import type { ColumnWithCards } from '@/lib/types'

interface ColumnProps {
  column: ColumnWithCards
  boardId: string
  onAddCard: () => void
  onAddColumn: () => void
}

export function Column({ column, boardId, onAddCard }: ColumnProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { mutate: deleteColumn, isPending: isDeleting } = useDeleteColumn(boardId)

  function handleDelete() {
    deleteColumn(column.id, {
      onSuccess: () => setDeleteOpen(false),
    })
  }

  return (
    <>
      <div
        className={cn(
          'flex-shrink-0 w-80 flex flex-col rounded-2xl p-4',
          // Frosted glass — matches design exactly
          'bg-surface-container/40 backdrop-blur-[8px]',
          'border border-outline-variant/10',
          // Column height fills the board canvas area
          'h-full',
        )}
      >
        {/* ── Column header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6 group px-2">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-on-surface-variant">
              {column.title}
            </h3>
            <span
              className={cn(
                'bg-surface-container-high text-on-surface-variant',
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
              )}
            >
              {column.cards.length}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  'p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface',
                  'hover:bg-surface-container-high',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  // Always visible when menu is open
                  'data-[state=open]:opacity-100',
                )}
                aria-label={`Column options for ${column.title}`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={onAddCard}
                className="gap-2 cursor-pointer"
              >
                <Plus className="size-4 text-outline" />
                Add card
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                className="gap-2 cursor-pointer"
              >
                <Trash2 className="size-4" />
                Delete column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Card list ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 px-2 pb-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-surface-container-highest">
          {column.cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              boardId={boardId}
            />
          ))}
        </div>

        {/* ── Add Card button ─────────────────────────────────────────────── */}
        <div className="px-2 pt-3">
          <button
            onClick={onAddCard}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3.5',
              'rounded-xl border-2 border-dashed border-outline-variant/20',
              'hover:border-primary/40 hover:bg-primary/5',
              'transition-all text-on-surface-variant hover:text-primary',
              'text-sm font-bold tracking-tight',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            )}
          >
            <Plus className="w-4 h-4" />
            Add Card
          </button>
        </div>
      </div>

      {/* ── Delete confirmation dialog ──────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete column</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-on-surface">{column.title}</span>
              {' '}and all {column.cards.length} card{column.cards.length !== 1 ? 's' : ''} inside it will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium',
                'border border-outline-variant/20 text-on-surface-variant',
                'hover:bg-surface-container hover:text-on-surface',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                'disabled:opacity-50 disabled:pointer-events-none',
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-bold',
                'bg-destructive/10 text-destructive',
                'hover:bg-destructive hover:text-background',
                'flex items-center gap-2 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
                'disabled:opacity-40 disabled:pointer-events-none',
              )}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete column'
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}