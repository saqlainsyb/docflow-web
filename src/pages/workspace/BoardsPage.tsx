// src/pages/workspace/BoardsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The main landing page for a workspace — lists all boards the current user
// can access, with a topbar for navigation context, search, and board creation.
//
// Data:
//   - Workspace name + member role: useWorkspace(workspaceId)
//   - Board list: stub for now — replaced with useWorkspaceBoards in Module 5
//
// Sub-components (page-scoped, not exported):
//   BoardsTopbar  — workspace name, breadcrumb, search, CTA buttons
//   BoardsGrid    — board cards + "create new" card
//   BoardCard     — individual board card
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
import { useAppDispatch } from '@/store/hooks'
import { useAppSelector } from '@/store/hooks'
import { openModal } from '@/store'
import { useWorkspace } from '@/hooks/useWorkspace'
import { cn } from '@/lib/utils'
import type { WorkspaceRole } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

// TODO: replace with BoardListItem from types.ts in Module 5
// when GET /workspaces/:id/boards is implemented
interface BoardStub {
  id: string
  title: string
  visibility: 'workspace' | 'private'
  updatedAt: string
  memberCount: number
}

type ViewMode = 'grid' | 'list'

// ── Helpers ───────────────────────────────────────────────────────────────────

function canManageBoards(role: WorkspaceRole | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

// ── BoardsTopbar ──────────────────────────────────────────────────────────────

interface BoardsTopbarProps {
  workspaceName: string
  canManage: boolean
  onInvite: () => void
  onCreateBoard: () => void
}

function BoardsTopbar({
  workspaceName,
  canManage,
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
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
              'text-outline group-focus-within:text-primary transition-colors',
            )}
            aria-hidden="true"
          />
          <input
            type="text"
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
  board: BoardStub
}

// Icon + accent color cycling — boards cycle through primary/secondary/tertiary
// based on their index. Full icon selection comes in Module 5 when board
// metadata includes an icon field.
const BOARD_ACCENTS = [
  { bg: 'bg-primary/10', text: 'text-primary', arrow: 'group-hover:text-primary' },
  { bg: 'bg-secondary/10', text: 'text-secondary', arrow: 'group-hover:text-secondary' },
  { bg: 'bg-df-tertiary/10', text: 'text-df-tertiary', arrow: 'group-hover:text-df-tertiary' },
] as const

function BoardCard({ board }: BoardCardProps) {
  // Stable accent derived from board ID — won't shift on re-renders
  const accentIndex =
    board.id.charCodeAt(0) % BOARD_ACCENTS.length
  const accent = BOARD_ACCENTS[accentIndex]

  return (
    <article
      className={cn(
        'group relative flex flex-col bg-surface-container rounded-2xl p-6',
        'ring-1 ring-outline-variant/5',
        'transition-all duration-200',
        'hover:-translate-y-1 hover:bg-surface-container-high hover:ring-primary/20',
        'cursor-pointer focus-within:ring-primary/20',
      )}
      tabIndex={0}
      aria-label={`Open board: ${board.title}`}
      // TODO: onClick navigate to /:workspaceId/boards/:boardId in Module 5
    >
      {/* Top row — icon + overflow menu */}
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
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded',
              'text-[10px] font-bold uppercase tracking-wider',
              'bg-primary/10 text-df-primary-fixed-dim',
            )}
          >
            <Users className="w-2.5 h-2.5" aria-hidden="true" />
            Workspace
          </span>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded',
              'text-[10px] font-bold uppercase tracking-wider',
              'bg-surface-container-highest text-outline',
            )}
          >
            <Lock className="w-2.5 h-2.5" aria-hidden="true" />
            Private
          </span>
        )}
        <span className="text-xs text-outline">· {board.updatedAt}</span>
      </div>

      {/* Footer — member count + arrow */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10 mt-auto">
        <div className="flex items-center gap-1.5 text-xs text-outline">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{board.memberCount} member{board.memberCount !== 1 ? 's' : ''}</span>
        </div>
        <ArrowRight
          className={cn(
            'w-4 h-4 text-outline transition-colors duration-150',
            accent.arrow,
          )}
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
        'min-h-[180px]',
      )}
      aria-label="Create new board"
    >
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center',
          'bg-surface-container-highest text-outline',
          'transition-all duration-200',
          'group-hover:bg-primary/20 group-hover:text-primary',
        )}
      >
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
      <div
        className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center',
          'bg-primary/10',
        )}
      >
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
  boards: BoardStub[]
  viewMode: ViewMode
  onCreateBoard: () => void
}

function BoardsGrid({ boards, viewMode, onCreateBoard }: BoardsGridProps) {
  if (boards.length === 0) {
    return <EmptyBoards onCreateBoard={onCreateBoard} />
  }

  return (
    <div
      className={cn(
        viewMode === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
          : 'flex flex-col gap-3',
      )}
    >
      {boards.map((board) => (
        <BoardCard key={board.id} board={board} />
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

  const { data: workspace, isLoading } = useWorkspace(workspaceId)

  // Derive current user's role from the workspace members array
  const currentMember = workspace?.members.find((m) => m.user_id === user?.id)
  const canManage = canManageBoards(currentMember?.role)

  // TODO: replace with useWorkspaceBoards(workspaceId) in Module 5
  // Stub boards so the grid renders with real structure during development
  const boards: BoardStub[] = []

  function handleCreateBoard() {
    if (!workspaceId) return
    dispatch(openModal({ type: 'createBoard', workspaceId }))
  }

  function handleInvite() {
    navigate('members')
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
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

          {/* Board grid / empty state */}
          <BoardsGrid
            boards={boards}
            viewMode={viewMode}
            onCreateBoard={handleCreateBoard}
          />

        </div>
      </div>
    </div>
  )
}