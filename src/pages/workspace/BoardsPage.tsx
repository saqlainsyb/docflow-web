// src/pages/workspace/BoardsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The main landing page for a workspace — lists all boards the current user
// can access, with a topbar for navigation context, search, and board creation.
//
// Data:
//   - Workspace name + member role: useWorkspace(workspaceId)
//   - Board list: useWorkspaceBoards(workspaceId) — sorted newest-first
//
// Sub-components (page-scoped, not exported):
//   BoardsTopbar  — workspace name, breadcrumb, search, CTA buttons
//   BoardsGrid    — board cards + "create new" card
//   BoardCard     — individual board card (navigates to /:wsId/boards/:boardId)
//   EmptyBoards   — shown when workspace has no boards yet
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  LayoutDashboard,
  Lock,
  Users,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { openModal } from '@/store'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useWorkspaceBoards } from '@/hooks/useWorkspaceBoards'
import { cn } from '@/lib/utils'
import type { BoardListItem, WorkspaceRole } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list'

// ── Helpers ───────────────────────────────────────────────────────────────────

function canManageBoards(role: WorkspaceRole | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

function formatUpdatedAt(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

// ── BoardsTopbar ──────────────────────────────────────────────────────────────

interface BoardsTopbarProps {
  workspaceName: string
  canManage: boolean
  search: string
  onSearchChange: (v: string) => void
  onInvite: () => void
  onCreateBoard: () => void
}

function BoardsTopbar({
  workspaceName,
  canManage,
  search,
  onSearchChange,
  onInvite,
  onCreateBoard,
}: BoardsTopbarProps) {
  return (
    <header className="h-16 flex items-center justify-between px-8 bg-background/80 backdrop-blur-md border-b border-outline-variant/10 sticky top-0 z-30">
      {/* Left — workspace name + breadcrumb */}
      <div className="flex items-center gap-4 min-w-0">
        <h2 className="font-display font-bold text-lg text-on-surface truncate">
          {workspaceName}
        </h2>
        <div className="h-4 w-px bg-outline-variant/30 shrink-0" />
        <span className="text-xs text-outline font-medium whitespace-nowrap">
          All Boards
        </span>
      </div>

      {/* Center — search */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative group">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline group-focus-within:text-primary transition-colors"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search boards…"
            className={cn(
              'w-full bg-surface-container-lowest rounded-full',
              'pl-9 pr-4 py-2 text-sm text-on-surface',
              'placeholder:text-outline/50',
              'border border-transparent',
              'focus:outline-none focus:border-primary/30',
              'focus:shadow-[0_0_15px_rgba(0,218,243,0.1)]',
              'transition-all duration-200',
            )}
          />
        </div>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-3 shrink-0">
        {canManage && (
          <button
            onClick={onInvite}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium',
              'border border-outline-variant/20 text-on-surface-variant',
              'hover:bg-surface-container hover:text-on-surface',
              'transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            )}
          >
            Invite
          </button>
        )}
        <button
          onClick={onCreateBoard}
          className={cn(
            'df-gradient-cta px-4 py-2 rounded-full',
            'text-sm font-bold text-primary-foreground',
            'flex items-center gap-2',
            'transition-opacity duration-150 hover:opacity-90',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
            'disabled:opacity-70 disabled:pointer-events-none',
          )}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create Board
        </button>
      </div>
    </header>
  )
}

// ── BoardCard ─────────────────────────────────────────────────────────────────

interface BoardCardProps {
  board: BoardListItem
  onClick: () => void
}

const BOARD_ACCENTS = [
  { bg: 'bg-primary/10', text: 'text-primary', arrow: 'group-hover:text-primary' },
  { bg: 'bg-secondary/10', text: 'text-secondary', arrow: 'group-hover:text-secondary' },
  { bg: 'bg-df-tertiary/10', text: 'text-df-tertiary', arrow: 'group-hover:text-df-tertiary' },
] as const

function BoardCard({ board, onClick }: BoardCardProps) {
  const accentIndex = board.id.charCodeAt(0) % BOARD_ACCENTS.length
  const accent = BOARD_ACCENTS[accentIndex]

  return (
    <article
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      role="button"
      tabIndex={0}
      aria-label={`Open board: ${board.title}`}
      className={cn(
        'group relative flex flex-col bg-surface-container rounded-2xl p-6',
        'ring-1 ring-outline-variant/5',
        'transition-all duration-200 cursor-pointer',
        'hover:-translate-y-1 hover:bg-surface-container-high hover:ring-primary/20',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      )}
    >
      {/* Top row — icon */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            'transition-transform duration-200 group-hover:scale-110',
            accent.bg,
          )}
        >
          <LayoutDashboard
            className={cn('w-6 h-6', accent.text)}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Title */}
      <h3 className="font-display font-bold text-lg text-on-surface mb-1 truncate">
        {board.title}
      </h3>

      {/* Meta — visibility badge + timestamp */}
      <div className="flex items-center gap-2 mb-6">
        {board.visibility === 'workspace' ? (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded',
            'text-[10px] font-bold uppercase tracking-wider',
            'bg-primary/10 text-df-primary-fixed-dim',
          )}>
            <Users className="w-2.5 h-2.5" aria-hidden="true" />
            Workspace
          </span>
        ) : (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded',
            'text-[10px] font-bold uppercase tracking-wider',
            'bg-surface-container-highest text-outline',
          )}>
            <Lock className="w-2.5 h-2.5" aria-hidden="true" />
            Private
          </span>
        )}
        <span className="text-xs text-outline">
          · Updated {formatUpdatedAt(board.updated_at)}
        </span>
      </div>

      {/* Footer — member count + card count + arrow */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10 mt-auto">
        <div className="flex items-center gap-3 text-xs text-outline">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            {board.member_count} member{board.member_count !== 1 ? 's' : ''}
          </span>
          {board.card_count > 0 && (
            <>
              <span className="text-outline/30">·</span>
              <span>{board.card_count} card{board.card_count !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
        <ArrowRight
          className={cn('w-4 h-4 text-outline transition-colors duration-150', accent.arrow)}
          aria-hidden="true"
        />
      </div>
    </article>
  )
}

// ── CreateBoardCard ───────────────────────────────────────────────────────────

function CreateBoardCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center justify-center gap-3',
        'bg-surface-container-lowest rounded-2xl p-6',
        'border-2 border-dashed border-outline-variant/20',
        'transition-all duration-200',
        'hover:border-primary/50 hover:bg-primary/5',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        'min-h-45',
      )}
      aria-label="Create new board"
    >
      <div className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center',
        'bg-surface-container-highest text-outline',
        'transition-all duration-200',
        'group-hover:bg-primary/20 group-hover:text-primary',
      )}>
        <Plus className="w-6 h-6" aria-hidden="true" />
      </div>
      <p className="font-display font-bold text-lg text-outline group-hover:text-on-surface transition-colors">
        Create New Board
      </p>
    </button>
  )
}

// ── EmptyBoards ───────────────────────────────────────────────────────────────

function EmptyBoards({ onCreateBoard }: { onCreateBoard: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10">
        <LayoutDashboard className="w-8 h-8 text-primary" aria-hidden="true" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-display font-bold text-xl text-on-surface">
          No boards yet
        </h3>
        <p className="text-sm text-outline max-w-xs">
          Boards are where your work lives. Create your first one to get started.
        </p>
      </div>
      <button
        onClick={onCreateBoard}
        className={cn(
          'df-gradient-cta px-6 py-2.5 rounded-full',
          'text-sm font-bold text-primary-foreground',
          'flex items-center gap-2',
          'hover:opacity-90 transition-opacity',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        )}
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Create your first board
      </button>
    </div>
  )
}

// ── BoardsGrid ────────────────────────────────────────────────────────────────

interface BoardsGridProps {
  boards: BoardListItem[]
  viewMode: ViewMode
  onCreateBoard: () => void
  onBoardClick: (boardId: string) => void
}

function BoardsGrid({ boards, viewMode, onCreateBoard, onBoardClick }: BoardsGridProps) {
  if (boards.length === 0) {
    return <EmptyBoards onCreateBoard={onCreateBoard} />
  }

  return (
    <div className={cn(
      viewMode === 'grid'
        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
        : 'flex flex-col gap-3',
    )}>
      {boards.map((board) => (
        <BoardCard
          key={board.id}
          board={board}
          onClick={() => onBoardClick(board.id)}
        />
      ))}
      <CreateBoardCard onClick={onCreateBoard} />
    </div>
  )
}

// ── BoardsPage ────────────────────────────────────────────────────────────────

export function BoardsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')

  const { data: workspace, isLoading: isWorkspaceLoading } = useWorkspace(workspaceId)
  const { data: boards = [], isLoading: isBoardsLoading } = useWorkspaceBoards(workspaceId)

  const currentMember = workspace?.members.find((m) => m.user_id === user?.id)
  const canManage = canManageBoards(currentMember?.role)

  // Client-side search filter — case-insensitive title match
  const filteredBoards = search.trim()
    ? boards.filter((b) =>
        b.title.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : boards

  function handleCreateBoard() {
    if (!workspaceId) return
    dispatch(openModal({ type: 'createBoard', workspaceId }))
  }

  function handleBoardClick(boardId: string) {
    navigate(`/${workspaceId}/boards/${boardId}`)
  }

  function handleInvite() {
    navigate('members')
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isWorkspaceLoading || isBoardsLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-outline" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <BoardsTopbar
        workspaceName={workspace?.name ?? ''}
        canManage={canManage}
        search={search}
        onSearchChange={setSearch}
        onInvite={handleInvite}
        onCreateBoard={handleCreateBoard}
      />

      {/* Page content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Page heading row */}
          <div className="flex items-end justify-between">
            <div>
              <p className="df-label-editorial text-primary mb-2">
                Workspace Central
              </p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-on-surface">
                My Boards
              </h1>
            </div>

            {/* View mode toggle */}
            <div
              className="flex bg-surface-container-low p-1 rounded-lg"
              role="group"
              aria-label="Board view mode"
            >
              <button
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                className={cn(
                  'p-2 rounded-md transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  viewMode === 'grid'
                    ? 'bg-surface-container-highest text-primary shadow-sm'
                    : 'text-outline hover:text-on-surface',
                )}
              >
                <LayoutGrid className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                className={cn(
                  'p-2 rounded-md transition-colors duration-150',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  viewMode === 'list'
                    ? 'bg-surface-container-highest text-primary shadow-sm'
                    : 'text-outline hover:text-on-surface',
                )}
              >
                <List className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Boards grid / list */}
          <BoardsGrid
            boards={filteredBoards}
            viewMode={viewMode}
            onCreateBoard={handleCreateBoard}
            onBoardClick={handleBoardClick}
          />

        </div>
      </div>
    </div>
  )
}