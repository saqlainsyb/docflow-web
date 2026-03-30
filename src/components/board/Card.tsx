// src/components/board/Card.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium redesign — all functionality preserved.
//
// Motion features (motion/react):
//   • whileHover lift + spring physics (y: -3)
//   • Color bar animated mount (scaleY spring)
//   • Shimmer sweep on hover (AnimatePresence)
//   • Footer items stagger in on mount
//   • Options button pops in/out (scale + opacity)
//   • Delete panel slides up (AnimatePresence)
//   • Drag overlay: tilt + deep shadow
//
// Zero functionality changes — same props, hooks, navigation, DnD.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'motion/react'
import {
  MoreHorizontal, FileText, Pencil, Archive, Trash2, Loader2, User,
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
  isOverlay?: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Soft ambient glow per color accent
const COLOR_GLOW: Record<string, string> = {
  '#EF4444': '0 8px 32px rgba(239,68,68,0.14)',
  '#F97316': '0 8px 32px rgba(249,115,22,0.14)',
  '#EAB308': '0 8px 32px rgba(234,179,8,0.14)',
  '#22C55E': '0 8px 32px rgba(34,197,94,0.14)',
  '#3B82F6': '0 8px 32px rgba(59,130,246,0.14)',
  '#A855F7': '0 8px 32px rgba(168,85,247,0.14)',
}

const COLOR_BORDER: Record<string, string> = {
  '#EF4444': 'rgba(239,68,68,0.3)',
  '#F97316': 'rgba(249,115,22,0.3)',
  '#EAB308': 'rgba(234,179,8,0.3)',
  '#22C55E': 'rgba(34,197,94,0.3)',
  '#3B82F6': 'rgba(59,130,246,0.3)',
  '#A855F7': 'rgba(168,85,247,0.3)',
}

const footerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
}
const footerItemVariants = {
  hidden: { opacity: 0, y: 5 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const } },
}

export function Card({ card, boardId, isOverlay = false }: CardProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const { mutate: archiveCard, isPending: isArchiving } = useArchiveCard(boardId)
  const { mutate: deleteCard, isPending: isDeleting } = useDeleteCard(boardId)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: isOverlay,
  })

  const dndStyle = { transform: CSS.Transform.toString(transform), transition }

  function handleTitleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!workspaceId) return
    navigate(`/${workspaceId}/boards/${boardId}/cards/${card.id}`)
  }

  const hoveredBorder = card.color
    ? COLOR_BORDER[card.color]
    : 'rgba(0,218,243,0.28)'
  const hoveredShadow = card.color
    ? `${COLOR_GLOW[card.color]}, 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)`
    : '0 8px 32px rgba(0,218,243,0.10), 0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)'

  return (
    <div
      ref={setNodeRef}
      style={dndStyle}
      {...attributes}
      {...listeners}
      className={cn('relative', isDragging && !isOverlay && 'opacity-0 pointer-events-none')}
    >
      <motion.div
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileHover={!isOverlay ? {
          y: -3,
          transition: { type: 'spring', stiffness: 420, damping: 30 },
        } : undefined}
        whileTap={!isOverlay ? {
          scale: 0.983,
          y: 0,
          transition: { duration: 0.08 },
        } : undefined}
        animate={isOverlay ? {
          rotate: 1.8,
          scale: 1.04,
        } : undefined}
        className="relative rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          background: 'linear-gradient(160deg, oklch(0.20 0.014 265 / 1) 0%, oklch(0.17 0.012 265 / 1) 100%)',
          border: `1px solid ${isHovered ? hoveredBorder : 'rgba(255,255,255,0.065)'}`,
          boxShadow: isHovered
            ? hoveredShadow
            : isOverlay
              ? '0 28px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,218,243,0.18)'
              : '0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        {/* ── Color accent bar ────────────────────────────────────────────── */}
        {card.color && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-0 bottom-0 w-0.75"
            style={{
              backgroundColor: card.color,
              transformOrigin: 'top',
              borderRadius: '0 2px 2px 0',
              boxShadow: `0 0 12px ${card.color}60`,
            }}
          />
        )}

        {/* ── Shimmer sweep ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {isHovered && !isOverlay && (
            <motion.div
              key="shimmer"
              initial={{ x: '-110%' }}
              animate={{ x: '210%' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.035) 50%, transparent 65%)',
              }}
            />
          )}
        </AnimatePresence>

        {/* ── Card content ─────────────────────────────────────────────────── */}
        <div className={cn('relative z-10 p-4 pb-3.5', card.color ? 'pl-4.5' : '')}>

          {/* Title */}
          <motion.h4
            onClick={handleTitleClick}
            onPointerDown={(e) => e.stopPropagation()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleTitleClick(e as unknown as React.MouseEvent)
            }}
            aria-label={`Open document for ${card.title}`}
            animate={{ color: isHovered ? 'var(--color-primary, #00DAF3)' : 'var(--color-on-surface, #e2e4ef)' }}
            transition={{ duration: 0.2 }}
            className={cn(
              'font-semibold text-sm leading-snug mb-3.5 pr-8',
              'cursor-pointer',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded',
            )}
          >
            {card.title}
          </motion.h4>

          {/* Footer */}
          <motion.div
            variants={footerVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-between"
          >
            <motion.div variants={footerItemVariants} className="flex items-center gap-1.5">
              {/* Assignee avatar or empty ring */}
              {card.assignee ? (
                <div
                  title={card.assignee.name}
                  className={cn(
                    'w-5.5 h-5.5 rounded-full shrink-0',
                    'ring-1 ring-white/10',
                    'bg-df-tertiary-container text-df-on-tertiary-container',
                    'flex items-center justify-center text-[8px] font-bold select-none',
                  )}
                >
                  {card.assignee.avatar_url ? (
                    <img src={card.assignee.avatar_url} alt={card.assignee.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getInitials(card.assignee.name)
                  )}
                </div>
              ) : (
                <div
                  title="Unassigned"
                  className="w-5.5 h-5.5 rounded-full border border-dashed border-outline-variant/20 flex items-center justify-center"
                >
                  <User className="w-2.5 h-2.5 text-outline/30" />
                </div>
              )}

              {/* Doc pill */}
              <motion.div
                animate={{
                  backgroundColor: isHovered ? 'rgba(0,218,243,0.10)' : 'rgba(255,255,255,0.04)',
                }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md"
              >
                <FileText className={cn(
                  'w-2.75 h-2.75 transition-colors duration-200',
                  isHovered ? 'text-primary' : 'text-outline/60',
                )} />
              </motion.div>
            </motion.div>

            <motion.span
              variants={footerItemVariants}
              className="text-[10px] font-medium tabular-nums text-on-surface-variant/45"
            >
              {formatDate(card.created_at)}
            </motion.span>
          </motion.div>
        </div>

        {/* ── Options button (appears on hover) ────────────────────────────── */}
        {!isOverlay && (
          <AnimatePresence>
            {isHovered && (
              <motion.div
                key="opts"
                initial={{ opacity: 0, scale: 0.65, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.65, rotate: -8 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
                className="absolute top-2.5 right-2.5 z-20"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label="Card options"
                      className={cn(
                        'p-1.5 rounded-lg',
                        'bg-surface-container-highest/80 backdrop-blur-sm',
                        'text-on-surface-variant hover:text-on-surface',
                        'border border-outline-variant/15',
                        'hover:bg-surface-container-highest',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                        'transition-all',
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
                      {isArchiving ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4 text-outline" />}
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
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── Delete confirmation overlay ───────────────────────────────────── */}
        <AnimatePresence>
          {deleteOpen && (
            <motion.div
              key="delete"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'absolute inset-0 z-30 rounded-2xl p-4 flex flex-col justify-between',
                'border border-destructive/20',
              )}
              style={{ background: 'oklch(0.14 0.018 265 / 0.97)', backdropFilter: 'blur(16px)' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div>
                <p className="text-sm font-semibold text-on-surface">Delete this card?</p>
                <p className="text-[11px] text-on-surface-variant/60 mt-1 leading-relaxed">
                  Permanently removes the card and its document.
                </p>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setDeleteOpen(false)}
                  disabled={isDeleting}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-bold',
                    'border border-outline-variant/20 text-on-surface-variant',
                    'hover:bg-surface-container hover:text-on-surface',
                    'transition-colors disabled:opacity-50 disabled:pointer-events-none',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { deleteCard(card.id); setDeleteOpen(false) }}
                  disabled={isDeleting}
                  className={cn(
                    'flex-1 py-2 rounded-xl text-xs font-bold',
                    'bg-destructive/90 text-white hover:bg-destructive',
                    'transition-all disabled:opacity-70 disabled:pointer-events-none',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
                  )}
                >
                  {isDeleting ? <Loader2 className="size-3.5 animate-spin mx-auto" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}