// src/components/board/Column.tsx
// ─────────────────────────────────────────────────────────────────────────────
// REDESIGNED: Premium glass column — "Obsidian Studio" aesthetic.
//
// Design features:
//   • True glassmorphism: backdrop-blur + gradient surfaces + inner glow edge
//   • Per-column accent color system (passed from BoardPage)
//   • Header: editorial ALL-CAPS title with pulsing accent dot
//   • Card count badge changes character based on load (few/many)
//   • Drop zone: animated colored rim + surface tint on hover
//   • Empty state: breathing icon with invitation text
//   • Add card button: dashed ghost → solid on hover with spring scale
//   • Delete dialog: animated confirmation inside Radix Dialog
//   • Column body scrolls independently with invisible scrollbar
//   • Motion: mount stagger, count badge layout, options menu entrance
//
// All prop-surface and functionality identical to previous version.
// New prop: accentColor: { dot: string; glow: string } from BoardPage.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { MoreHorizontal, Plus, Trash2, Loader2, Layers } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
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

interface AccentColor {
  dot: string
  glow: string
}

interface ColumnProps {
  column: ColumnWithCards
  boardId: string
  onAddCard: () => void
  onAddColumn: () => void
  index?: number
  accentColor?: AccentColor
}

// ── Default accent (cyan) ─────────────────────────────────────────────────────
const DEFAULT_ACCENT: AccentColor = { dot: '#00DAF3', glow: 'rgba(0,218,243,0.18)' }

// ── Card stagger variants ─────────────────────────────────────────────────────
const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.975 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  },
}

// ── Column ────────────────────────────────────────────────────────────────────

export function Column({
  column,
  boardId,
  onAddCard,
  index = 0,
  accentColor = DEFAULT_ACCENT,
}: ColumnProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [headerHovered, setHeaderHovered] = useState(false)

  const { mutate: deleteColumn, isPending: isDeleting } = useDeleteColumn(boardId)
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: column.id })

  const cardCount = column.cards.length
  const hasCards = cardCount > 0
  const { dot, glow } = accentColor

  function handleDelete() {
    deleteColumn(column.id, { onSuccess: () => setDeleteOpen(false) })
  }

  return (
    <>
      <div
        ref={setDropRef}
        className="shrink-0 w-72 flex flex-col rounded-2xl relative"
        style={{
          // Column height: fills board canvas, max 80vh to leave scroll room
          maxHeight: 'calc(100vh - 120px)',
          minHeight: '160px',
          background: isOver
            ? `linear-gradient(175deg, oklch(0.21 0.020 265 / 0.9) 0%, oklch(0.18 0.017 265 / 0.88) 100%)`
            : `linear-gradient(175deg, oklch(0.195 0.016 265 / 0.82) 0%, oklch(0.165 0.014 265 / 0.80) 100%)`,
          backdropFilter: 'blur(22px) saturate(160%)',
          border: isOver
            ? `1px solid ${dot}44`
            : '1px solid rgba(255,255,255,0.065)',
          boxShadow: isOver
            ? `0 0 0 2px ${dot}20, 0 8px 40px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.07)`
            : '0 4px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.055)',
          transition: 'background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease',
        }}
      >

        {/* Inner top-edge light seam */}
        <div
          className="absolute top-0 left-8 right-8 h-px pointer-events-none rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
          }}
        />

        {/* ── Column header ─────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3 relative"
          onMouseEnter={() => setHeaderHovered(true)}
          onMouseLeave={() => setHeaderHovered(false)}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Accent dot */}
            <motion.div
              animate={{
                scale: headerHovered ? 1.5 : 1,
                opacity: headerHovered ? 1 : 0.65,
              }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: dot,
                boxShadow: headerHovered ? `0 0 8px ${dot}` : 'none',
              }}
            />

            {/* Title */}
            <h3
              className="font-bold text-[11px] uppercase truncate"
              style={{
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: '0.12em',
                fontFamily: 'var(--df-font-display)',
              }}
            >
              {column.title}
            </h3>

            {/* Card count badge */}
            <motion.div
              layout
              className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums"
              style={{
                background: hasCards ? `${dot}1A` : 'rgba(255,255,255,0.06)',
                color: hasCards ? dot : 'rgba(255,255,255,0.28)',
                border: hasCards ? `1px solid ${dot}28` : '1px solid rgba(255,255,255,0.07)',
                transition: 'background 0.25s, color 0.25s, border-color 0.25s',
              }}
            >
              {cardCount}
            </motion.div>
          </div>

          {/* Options — appears on header hover */}
          <AnimatePresence>
            {headerHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.65, rotate: -12 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.65, rotate: -12 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        'p-1.5 rounded-lg transition-all',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                      )}
                      style={{
                        color: 'rgba(255,255,255,0.45)',
                        background: 'transparent',
                        border: '1px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)'
                        ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'
                      }}
                      aria-label={`Options for ${column.title}`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={onAddCard} className="gap-2 cursor-pointer">
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Subtle divider */}
        <div
          className="mx-4 h-px mb-3"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
        />

        {/* ── Card list ─────────────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto flex flex-col gap-2 px-3 pb-2 min-h-0"
          style={{
            scrollbarWidth: 'none',
            // Firefox
          }}
        >
          <style>{`
            .column-scroll::-webkit-scrollbar { display: none; }
          `}</style>

          <AnimatePresence mode="popLayout">
            {!hasCards ? (
              // Empty state
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center justify-center py-10 gap-2.5"
              >
                <motion.div
                  animate={{ opacity: [0.25, 0.5, 0.25] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Layers className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.22)' }} />
                </motion.div>
                <p className="text-[11px] font-medium text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                  Drop cards here
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="flex flex-col gap-2"
              >
                {column.cards.map((card) => (
                  <motion.div key={card.id} variants={cardVariants} layout="position">
                    <Card card={card} boardId={boardId} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Drop zone highlight ring (only while dragging over) ────────────── */}
        <AnimatePresence>
          {isOver && (
            <motion.div
              key="drop-ring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                border: `2px solid ${dot}55`,
                boxShadow: `inset 0 0 30px ${dot}0A`,
              }}
            />
          )}
        </AnimatePresence>

        {/* ── Add Card button ───────────────────────────────────────────────── */}
        <div className="px-3 pt-1.5 pb-3">
          <motion.button
            onClick={onAddCard}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.975 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5',
              'rounded-xl text-[11px] font-bold uppercase tracking-widest',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              'transition-colors duration-200 group',
            )}
            style={{
              color: 'rgba(255,255,255,0.28)',
              border: '1px dashed rgba(255,255,255,0.10)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = dot
              ;(e.currentTarget as HTMLElement).style.borderColor = `${dot}40`
              ;(e.currentTarget as HTMLElement).style.background = `${dot}08`
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.28)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)'
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <motion.span
              className="inline-flex"
              whileHover={{ rotate: 90 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <Plus className="w-3.5 h-3.5" />
            </motion.span>
            Add card
          </motion.button>
        </div>
      </div>

      {/* ── Delete confirmation dialog ─────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{column.title}"?</DialogTitle>
            <DialogDescription>
              This will permanently delete the column and all {cardCount} card{cardCount !== 1 ? 's' : ''} inside it.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold',
                'border border-outline-variant/20 text-on-surface-variant',
                'hover:bg-surface-container hover:text-on-surface',
                'transition-colors disabled:opacity-50',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold',
                'bg-destructive text-white hover:bg-destructive/90',
                'transition-all disabled:opacity-70',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
              )}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
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