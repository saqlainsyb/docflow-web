// src/pages/workspace/DocumentEditorPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Full-screen collaborative document editor.
//
// Route: /:workspaceId/boards/:boardId/cards/:cardId
//
// Bootstrap sequence (must be strictly ordered):
//   1. Read cardId from URL → look up card in the board cache (already loaded)
//      → extract document_id (every card always has one)
//   2. POST /documents/:id/token  → scoped JWT + assigned cursor color
//   3. GET  /documents/:id/snapshot → base64 Yjs state + server clock
//   4. Decode snapshot, apply to Y.Doc via Y.applyUpdate
//   5. Create WebsocketProvider — speaks the y-websocket binary protocol that
//      the Go backend implements (MsgSync 0x00, MsgAwareness 0x01)
//   6. Mount <CollaborativeEditor provider={provider} ydoc={ydoc} />
//      CollaborationCursor requires a live provider at useEditor() init time.
//      We solve this by keeping it in a child component that only mounts once
//      the provider is created — never passing undefined to the extension.
//
// Architecture note — why CollaborativeEditor is a separate component:
//   CollaborationCursor reads provider.awareness synchronously when TipTap
//   builds its ProseMirror plugins. If provider is undefined at that moment,
//   it throws "Cannot read properties of undefined (reading 'awareness')".
//   The dependency-array trick on useEditor() does not help because
//   useEditor() still runs on the very first render before any effect fires.
//   The only safe fix: don't call useEditor() until the provider exists —
//   which conditional rendering of a child component achieves cleanly.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { ArrowLeft, WifiOff, AlertCircle } from 'lucide-react'

import { useBoard } from '@/hooks/useBoard'
import { useDocumentToken } from '@/hooks/useDocumentToken'
import { useDocumentSnapshot } from '@/hooks/useDocumentSnapshot'
import { cn } from '@/lib/utils'
import type { BoardDetailResponse } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type WsStatus = 'connecting' | 'connected' | 'disconnected'

// ── Sub-components ────────────────────────────────────────────────────────────

function ConnectionBadge({ status }: { status: WsStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'w-2 h-2 rounded-full shrink-0',
          status === 'connected'    && 'bg-green-500',
          status === 'connecting'   && 'bg-amber-400 animate-pulse',
          status === 'disconnected' && 'bg-red-500',
        )}
      />
      <span
        className={cn(
          'text-xs font-medium',
          status === 'connected'    && 'text-green-400',
          status === 'connecting'   && 'text-amber-400',
          status === 'disconnected' && 'text-red-400',
        )}
      >
        {status === 'connected'    && 'Live'}
        {status === 'connecting'   && 'Connecting…'}
        {status === 'disconnected' && 'Disconnected'}
      </span>
    </div>
  )
}

function EditorTopbar({
  cardTitle,
  wsStatus,
  onBack,
}: {
  cardTitle: string
  wsStatus: WsStatus
  onBack: () => void
}) {
  return (
    <header
      className={cn(
        'h-16 sticky top-0 z-30 shrink-0',
        'bg-background/80 backdrop-blur-md',
        'border-b border-outline-variant/10',
        'flex items-center justify-between px-6',
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onBack}
          aria-label="Back to board"
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
            'text-on-surface-variant hover:bg-surface-container-highest',
            'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          )}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-lg text-on-surface truncate leading-tight">
            {cardTitle}
          </h1>
          <p className="text-xs text-on-surface-variant/60 font-medium">Document</p>
        </div>
      </div>
      <ConnectionBadge status={wsStatus} />
    </header>
  )
}

function EditorSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 animate-pulse space-y-4">
      <div className="h-8 bg-surface-container-low rounded-lg w-3/4" />
      <div className="space-y-2 pt-4">
        <div className="h-4 bg-surface-container-low rounded w-full" />
        <div className="h-4 bg-surface-container-low rounded w-5/6" />
        <div className="h-4 bg-surface-container-low rounded w-4/5" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-4 bg-surface-container-low rounded w-full" />
        <div className="h-4 bg-surface-container-low rounded w-2/3" />
      </div>
    </div>
  )
}

// ── CollaborativeEditor ───────────────────────────────────────────────────────
// Only mounted once provider and ydoc are both fully initialised.
// This guarantees useEditor() always receives a live provider — never undefined.

interface CollaborativeEditorProps {
  provider: WebsocketProvider
  ydoc: Y.Doc
  wsStatus: WsStatus
}

function CollaborativeEditor({ provider, ydoc, wsStatus }: CollaborativeEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Yjs owns undo/redo — disable ProseMirror's built-in history stack
        history: false,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      // provider is guaranteed non-null here — component only mounts after
      // the provider is created in the parent effect.
      CollaborationCursor.configure({
        provider,
      }),
    ],
    editorProps: {
      attributes: {
        class: cn(
          'outline-none min-h-[60vh]',
          'prose prose-invert prose-sm sm:prose-base max-w-none',
          'prose-headings:font-display prose-headings:font-bold prose-headings:text-on-surface',
          'prose-p:text-on-surface prose-p:leading-relaxed',
          'prose-strong:text-on-surface',
          'prose-code:text-primary prose-code:bg-surface-container-high prose-code:rounded prose-code:px-1',
          'prose-blockquote:border-primary/30 prose-blockquote:text-on-surface-variant',
          'prose-ul:text-on-surface prose-ol:text-on-surface',
          'prose-hr:border-outline-variant/20',
        ),
      },
    },
  })

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 relative">
      {wsStatus === 'disconnected' && (
        <div
          className={cn(
            'mb-6 flex items-center gap-3 px-4 py-3 rounded-xl',
            'bg-destructive/10 border border-destructive/20 text-destructive',
          )}
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">
            Connection lost — changes are saved locally and will sync on reconnect.
          </p>
        </div>
      )}

      {editor?.isEmpty && (
        <p
          className="absolute top-12 left-6 pointer-events-none text-on-surface-variant/30 text-base select-none"
          aria-hidden="true"
        >
          Start writing…
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function base64ToUint8Array(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(0)
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function findCardInBoard(board: BoardDetailResponse | undefined, cardId: string) {
  if (!board) return undefined
  for (const col of board.columns) {
    const card = col.cards.find((c) => c.id === cardId)
    if (card) return card
  }
  return undefined
}

// ── DocumentEditorPage ────────────────────────────────────────────────────────

export function DocumentEditorPage() {
  const { workspaceId, boardId, cardId } = useParams<{
    workspaceId: string
    boardId: string
    cardId: string
  }>()
  const navigate = useNavigate()

  // ── Step 1: card → document_id from board cache ───────────────────────────

  const { data: board } = useBoard(boardId)

  const card = useMemo(
    () => findCardInBoard(board, cardId ?? ''),
    [board, cardId],
  )

  const documentId = card?.document_id

  // ── Step 2: scoped document JWT ───────────────────────────────────────────

  const {
    data: tokenData,
    isLoading: isTokenLoading,
    isError: isTokenError,
    error: tokenError,
  } = useDocumentToken(documentId)

  // ── Step 3: initial Yjs snapshot (enabled only after token is ready) ───────

  const {
    data: snapshotData,
    isLoading: isSnapshotLoading,
    isError: isSnapshotError,
  } = useDocumentSnapshot({
    documentId,
    tokenReady: Boolean(tokenData),
  })

  // ── Steps 4–5: Y.Doc + WebsocketProvider ─────────────────────────────────
  //
  // ydocRef: created once, never re-created — it is the in-memory CRDT.
  // readyProvider: lifted into state so React re-renders and mounts
  //   <CollaborativeEditor> exactly once after the provider is created.
  //   A plain ref would not trigger the re-render that swaps skeleton → editor.

  const ydocRef = useRef<Y.Doc>(new Y.Doc())
  const providerRef = useRef<WebsocketProvider | null>(null)
  const [readyProvider, setReadyProvider] = useState<WebsocketProvider | null>(null)
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting')

  useEffect(() => {
    if (!tokenData || !snapshotData || !documentId) return
    if (providerRef.current) return // already initialised

    const ydoc = ydocRef.current

    // Hydrate Y.Doc with server snapshot before connecting —
    // editor shows last-known content immediately, sync fills in the delta.
    const snapshotBytes = base64ToUint8Array(snapshotData.snapshot)
    if (snapshotBytes.length > 0) {
      Y.applyUpdate(ydoc, snapshotBytes)
    }

    const wsBase = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080'

    const provider = new WebsocketProvider(
      `${wsBase}/ws/documents`,
      documentId,
      ydoc,
      {
        params: { token: tokenData.token },
        connect: false, // connect after listeners are attached
      },
    )

    providerRef.current = provider

    provider.on('status', ({ status }: { status: string }) => {
      if (status === 'connected')    setWsStatus('connected')
      if (status === 'connecting')   setWsStatus('connecting')
      if (status === 'disconnected') setWsStatus('disconnected')
    })

    // Awareness: cursor color assigned by the server for this session.
    // TODO: replace tokenData.color with auth user name once profile is wired.
    provider.awareness.setLocalStateField('user', {
      name:  tokenData.color,
      color: tokenData.color,
    })

    provider.connect()

    // Lift into state — triggers the re-render that mounts CollaborativeEditor
    setReadyProvider(provider)

    return () => {
      provider.disconnect()
      provider.destroy()
      providerRef.current = null
      setReadyProvider(null)
      setWsStatus('connecting')
    }
  }, [tokenData, snapshotData, documentId])

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleBack = () => navigate(`/${workspaceId}/boards/${boardId}`)

  // ── Error states ──────────────────────────────────────────────────────────

  const tokenStatus = (tokenError as { response?: { status?: number } })?.response?.status
  const isAccessDenied = tokenStatus === 403 || tokenStatus === 401

  if (isTokenError) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-on-surface font-semibold">
          {isAccessDenied
            ? "You don't have access to this document"
            : 'Failed to open document'}
        </p>
        <button
          onClick={handleBack}
          className="text-primary text-sm hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Back to board
        </button>
      </div>
    )
  }

  if (isSnapshotError) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <WifiOff className="w-8 h-8 text-destructive" />
        <p className="text-on-surface font-semibold">Failed to load document content</p>
        <button
          onClick={handleBack}
          className="text-primary text-sm hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          Back to board
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isBootstrapping = !board || isTokenLoading || isSnapshotLoading || !readyProvider

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <EditorTopbar
        cardTitle={card?.title ?? '…'}
        wsStatus={wsStatus}
        onBack={handleBack}
      />

      <div className="flex-1 overflow-y-auto">
        {isBootstrapping ? (
          <EditorSkeleton />
        ) : (
          // readyProvider is non-null here — isBootstrapping gate above ensures it
          <CollaborativeEditor
            provider={readyProvider!}
            ydoc={ydocRef.current}
            wsStatus={wsStatus}
          />
        )}
      </div>
    </div>
  )
}