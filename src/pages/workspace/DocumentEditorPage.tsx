import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'
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

type WsStatus = 'connecting' | 'connected' | 'disconnected'

const CURSOR_PALETTE = [
  '#F87171', '#FB923C', '#FBBF24', '#34D399',
  '#38BDF8', '#818CF8', '#E879F9', '#A3E635',
  '#F472B6', '#60A5FA', '#4ADE80', '#C084FC',
]

function colorFromUserId(userId: string): string {
  if (!userId) return CURSOR_PALETTE[0]
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return CURSOR_PALETTE[hash % CURSOR_PALETTE.length]
}

function renderCursor(user: any): HTMLElement {
  const displayName = user?.name ?? `User: ${user?.clientId ?? 'Unknown'}`
  const displayColor = user?.color ?? '#FB923C'

  const caret = document.createElement('span')
  Object.assign(caret.style, {
    position: 'relative',
    display: 'inline-block',
    width: '2px',
    height: '1.25em',
    verticalAlign: 'text-top',
    backgroundColor: displayColor,
    boxShadow: `0 0 4px 1px ${displayColor}99, 0 0 10px 3px ${displayColor}33`,
    borderRadius: '1px',
    marginLeft: '-1px',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: '10',
  })

  const chip = document.createElement('span')
  chip.textContent = displayName
  Object.assign(chip.style, {
    position: 'absolute',
    top: '-1.7em',
    left: '2px',
    fontSize: '10px',
    fontWeight: '600',
    fontFamily: 'Inter, system-ui, sans-serif',
    lineHeight: '1',
    padding: '2px 7px 3px',
    borderRadius: '4px',
    backgroundColor: displayColor,
    color: '#fff',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    userSelect: 'none',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    transform: 'translateY(-2px)',
  })

  caret.appendChild(chip)
  return caret
}

// Sub-components
function ConnectionBadge({ status }: { status: WsStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(
        'w-2 h-2 rounded-full shrink-0',
        status === 'connected' && 'bg-green-500',
        status === 'connecting' && 'bg-amber-400 animate-pulse',
        status === 'disconnected' && 'bg-red-500',
      )} />
      <span className={cn(
        'text-xs font-medium',
        status === 'connected' && 'text-green-400',
        status === 'connecting' && 'text-amber-400',
        status === 'disconnected' && 'text-red-400',
      )}>
        {status === 'connected' && 'Live'}
        {status === 'connecting' && 'Connecting…'}
        {status === 'disconnected' && 'Disconnected'}
      </span>
    </div>
  )
}

function EditorTopbar({ cardTitle, wsStatus, onBack }: {
  cardTitle: string
  wsStatus: WsStatus
  onBack: () => void
}) {
  return (
    <header className="h-16 sticky top-0 z-30 shrink-0 bg-background/80 backdrop-blur-md border-b border-outline-variant/10 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onBack}
          aria-label="Back to board"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-bold text-lg text-on-surface truncate leading-tight">{cardTitle}</h1>
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
      </div>
    </div>
  )
}

interface CollaborativeEditorProps {
  provider: WebsocketProvider
  ydoc: Y.Doc
  wsStatus: WsStatus
  userName: string
  cursorColor: string
}

function CollaborativeEditor({ provider, ydoc, wsStatus, userName, cursorColor }: CollaborativeEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: userName, color: cursorColor },
        render: renderCursor,
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

  useEffect(() => {
    if (editor) {
      editor.commands.updateUser({ name: userName, color: cursorColor })
    }
  }, [editor, userName, cursorColor])

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 relative">
      {wsStatus === 'disconnected' && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
          <WifiOff className="w-4 h-4 shrink-0" />
          <p className="text-sm font-medium">Connection lost — changes are saved locally and will sync on reconnect.</p>
        </div>
      )}

      {editor?.isEmpty && (
        <p className="absolute top-12 left-6 pointer-events-none text-on-surface-variant/30 text-base select-none" aria-hidden="true">
          Start writing…
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}

// ====================== MAIN PAGE ======================
export function DocumentEditorPage() {
  const { workspaceId, boardId, cardId } = useParams<{ workspaceId: string; boardId: string; cardId: string }>()
  const navigate = useNavigate()

  const authUser = useAppSelector((s) => s.auth.user)
  const userName = authUser?.name ?? 'Anonymous'
  const userId = authUser?.id ?? ''
  const cursorColor = useMemo(() => colorFromUserId(userId), [userId])

  const { data: board, isLoading: isBoardLoading, isError: isBoardError } = useBoard(boardId)
  const card = useMemo(() => {
    if (!board || !cardId) return undefined
    for (const col of board.columns) {
      const found = col.cards.find(c => c.id === cardId)
      if (found) return found
    }
    return undefined
  }, [board, cardId])

  const documentId = card?.document_id

  const { data: tokenData, isLoading: isTokenLoading, isError: isTokenError, error: tokenError } = useDocumentToken(documentId)
  const { data: snapshotData, isLoading: isSnapshotLoading, isError: isSnapshotError } = useDocumentSnapshot({
    documentId,
    tokenReady: Boolean(tokenData)
  })

  const ydocRef = useRef<Y.Doc>(new Y.Doc())
  const providerRef = useRef<WebsocketProvider | null>(null)
  const [readyProvider, setReadyProvider] = useState<WebsocketProvider | null>(null)
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting')

  useEffect(() => {
    if (!tokenData || !snapshotData || !documentId) return
    if (providerRef.current) return

    const ydoc = ydocRef.current
    const bytes = base64ToUint8Array(snapshotData.snapshot)
    if (bytes.length > 0) Y.applyUpdate(ydoc, bytes)

    const getWsBase = () => {
      if (import.meta.env.DEV) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        return `${protocol}//${window.location.hostname}:8080`
      }
      return import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080'
    }

    const wsBase = getWsBase()
    const provider = new WebsocketProvider(
      `${wsBase}/ws/documents`,
      documentId,
      ydoc,
      { params: { token: tokenData.token }, connect: false }
    )

    providerRef.current = provider

    provider.on('status', ({ status }: { status: string }) => {
      console.log(`[WS Status] ${status}`)
      if (status === 'connected') setWsStatus('connected')
      if (status === 'connecting') setWsStatus('connecting')
      if (status === 'disconnected') setWsStatus('disconnected')
    })

    provider.on('connection-error', (err: any) => {
      console.error('[WS Error]', err)
    })

    provider.connect()

    const timeout = setTimeout(() => {
      if (provider.awareness) {
        provider.awareness.setLocalStateField('user', {
          name: userName,
          color: cursorColor,
        })
        console.log(`[Awareness] Set for ${userName}`)
      }
    }, 250)

    provider.awareness.on('change', ({ added }: { added: number[] }) => {
      if (added.length > 0) {
        setTimeout(() => {
          provider.awareness.setLocalStateField('user', {
            name: userName,
            color: cursorColor,
          })
        }, 500)
      }
    })

    setReadyProvider(provider)

    // ── Ghost cursor fix ───────────────────────────────────────────────────
    // useEffect cleanup (return fn) does NOT fire on page refresh or tab
    // close — the browser just kills the JS context. Without an explicit
    // null broadcast, the Yjs awareness entry for this client stays alive
    // on the server and on every other connected client, appearing as a
    // ghost cursor until their awareness TTL expires.
    //
    // The beforeunload listener fires synchronously before the page unloads,
    // giving us one last chance to broadcast setLocalState(null) over the
    // still-open WebSocket. This covers refresh + tab close.
    //
    // The cleanup return fn still handles normal SPA navigation (back button,
    // route change) where React unmounts the component gracefully.
    // ──────────────────────────────────────────────────────────────────────
    const handleBeforeUnload = () => {
      provider.awareness.setLocalState(null)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // setLocalState(null) BEFORE disconnect — once the socket closes
      // the broadcast can't reach anyone.
      provider.awareness.setLocalState(null)
      provider.disconnect()
      provider.destroy()
      providerRef.current = null
      setReadyProvider(null)
      setWsStatus('connecting')
    }
  }, [tokenData, snapshotData, documentId, userName, cursorColor])

  // Keep awareness in sync if name/color changes mid-session
  useEffect(() => {
    if (!readyProvider) return
    readyProvider.awareness.setLocalStateField('user', {
      name: userName,
      color: cursorColor,
    })
  }, [readyProvider, userName, cursorColor])

  const handleBack = useCallback(() => {
    navigate(`/${workspaceId}/boards/${boardId}`)
  }, [navigate, workspaceId, boardId])

  const tokenStatus = (tokenError as any)?.response?.status ?? (tokenError as any)?.status
  const isAccessDenied = tokenStatus === 403 || tokenStatus === 401

  if (isTokenError) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-on-surface font-semibold">
          {isAccessDenied ? "You don't have access to this document" : 'Failed to open document'}
        </p>
        <button onClick={handleBack} className="text-primary text-sm hover:underline">Back to board</button>
      </div>
    )
  }

  if (isSnapshotError || isBoardError || (!documentId && !isBoardLoading && board)) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <WifiOff className="w-8 h-8 text-destructive" />
        <p className="text-on-surface font-semibold">Failed to load document or board not found</p>
        <button onClick={handleBack} className="text-primary text-sm hover:underline">Back to board</button>
      </div>
    )
  }

  const isBootstrapping = isBoardLoading || isTokenLoading || isSnapshotLoading || !readyProvider || !board || !documentId

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <EditorTopbar
        cardTitle={card?.title ?? '…'}
        wsStatus={wsStatus}
        onBack={handleBack}
      />
      <div className="flex-1 overflow-y-auto">
        {isBootstrapping ? <EditorSkeleton /> : (
          <CollaborativeEditor
            provider={readyProvider!}
            ydoc={ydocRef.current}
            wsStatus={wsStatus}
            userName={userName}
            cursorColor={cursorColor}
          />
        )}
      </div>
    </div>
  )
}

function base64ToUint8Array(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(0)
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}