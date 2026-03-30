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

// ── Awareness user shape ───────────────────────────────────────────────────────
// Stored in Yjs awareness per connected client.
interface AwarenessUser {
  name: string
  color: string
  avatar_url: string | null
  typing?: boolean
}

// What we read back out of provider.awareness.getStates()
interface ConnectedUser extends AwarenessUser {
  clientId: number
}

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

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
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

// ── useAwarenessUsers ──────────────────────────────────────────────────────────
// Subscribes to Yjs awareness changes and returns the live list of ALL connected
// users including self — so the current user also appears in the avatar stack.
function useAwarenessUsers(provider: WebsocketProvider | null): ConnectedUser[] {
  const [users, setUsers] = useState<ConnectedUser[]>([])

  useEffect(() => {
    if (!provider) {
      setUsers([])
      return
    }

    const read = () => {
      const states = provider.awareness.getStates()
      const result: ConnectedUser[] = []
      states.forEach((state, clientId) => {
        const u = state.user as AwarenessUser | undefined
        if (u?.name) {
          result.push({ clientId, ...u })
        }
      })
      // Stable order: sort by clientId so avatars don't shuffle on every update
      result.sort((a, b) => a.clientId - b.clientId)
      setUsers(result)
    }

    read()
    provider.awareness.on('change', read)
    return () => {
      provider.awareness.off('change', read)
    }
  }, [provider])

  return users
}

// ── CollaboratorAvatars ────────────────────────────────────────────────────────
// Stacked ring of avatars for everyone currently in the document room.
// Shows up to MAX_VISIBLE avatars, then a "+N" overflow chip.
// Each avatar has a colored ring border matching the user's cursor color.
const MAX_VISIBLE = 3
// Match sidebar avatar size (w-9 h-9 = 36px)
const AVATAR_SIZE = 36
// Thin separator gap only — page bg creates a clean edge between avatars
const OVERLAP = 8

// Injected once into <head> — keyframes can't be expressed in inline styles
const TYPING_STYLE = `
@keyframes df-typing-ring {
  0%   { box-shadow: 0 0 0 2px oklch(0.12 0.015 265), 0 0 0 3.5px var(--ring-color), 0 0 6px 2px var(--ring-glow); }
  50%  { box-shadow: 0 0 0 2px oklch(0.12 0.015 265), 0 0 0 3.5px var(--ring-color), 0 0 10px 4px var(--ring-glow); }
  100% { box-shadow: 0 0 0 2px oklch(0.12 0.015 265), 0 0 0 3.5px var(--ring-color), 0 0 6px 2px var(--ring-glow); }
}
`
if (typeof document !== 'undefined' && !document.getElementById('df-typing-style')) {
  const el = document.createElement('style')
  el.id = 'df-typing-style'
  el.textContent = TYPING_STYLE
  document.head.appendChild(el)
}

function CollaboratorAvatar({ user, index }: { user: ConnectedUser; index: number }) {
  const [imgFailed, setImgFailed] = useState(false)

  // ring-color at 90% opacity, glow at 35% — subtle but visible
  const ringColor = user.color + 'e6'
  const glowColor = user.color + '59'

  return (
    <div
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: '50%',
        flexShrink: 0,
        marginLeft: index === 0 ? 0 : -OVERLAP,
        zIndex: MAX_VISIBLE - index,
        // CSS custom props picked up by the keyframe
        ['--ring-color' as any]: ringColor,
        ['--ring-glow' as any]: glowColor,
        boxShadow: user.typing
          ? undefined  // animation drives box-shadow when typing
          : '0 0 0 2px oklch(0.12 0.015 265)',
        animation: user.typing
          ? 'df-typing-ring 1.2s ease-in-out infinite'
          : 'none',
        transition: 'transform 0.15s ease, box-shadow 0.3s ease',
        cursor: 'default',
      }}
      title={user.name}
      className="hover:!z-50 hover:scale-105"
    >
      {user.avatar_url && !imgFailed ? (
        <img
          src={user.avatar_url}
          alt={user.name}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="w-full h-full rounded-full flex items-center justify-center bg-df-tertiary-container text-df-on-tertiary-container text-xs font-bold select-none">
          {getInitials(user.name)}
        </div>
      )}
    </div>
  )
}

function CollaboratorAvatars({ provider }: { provider: WebsocketProvider | null }) {
  const users = useAwarenessUsers(provider)

  if (users.length === 0) return null

  const visible = users.slice(0, MAX_VISIBLE)
  const overflow = users.length - MAX_VISIBLE

  return (
    <div className="flex items-center">
      {visible.map((user, i) => (
        <CollaboratorAvatar key={user.clientId} user={user} index={i} />
      ))}

      {overflow > 0 && (
        // Overflow chip matches the same avatar style
        <div
          className="flex items-center justify-center rounded-full bg-df-tertiary-container text-df-on-tertiary-container text-xs font-bold select-none cursor-default"
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            marginLeft: -OVERLAP,
            zIndex: 0,
            flexShrink: 0,
            boxShadow: '0 0 0 2px oklch(0.12 0.015 265)',
          }}
          title={`${overflow} more user${overflow === 1 ? '' : 's'}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function EditorTopbar({ cardTitle, wsStatus, onBack, provider }: {
  cardTitle: string
  wsStatus: WsStatus
  onBack: () => void
  provider: WebsocketProvider | null
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

      {/* Right side: avatar stack + connection badge */}
      <div className="flex items-center gap-4 shrink-0">
        <CollaboratorAvatars provider={provider} />
        <ConnectionBadge status={wsStatus} />
      </div>
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

  // Typing indicator — set typing:true on every local doc update,
  // clear it after 1.5s of inactivity. Uses ydoc observer so it only
  // fires on actual content changes, not cursor moves or remote updates.
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>

    const onUpdate = (_: any, transaction: any) => {
      // Only react to local transactions (the current user typing)
      if (!transaction.local) return

      provider.awareness.setLocalStateField('typing', true)
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        provider.awareness.setLocalStateField('typing', false)
      }, 1500)
    }

    ydoc.on('update', onUpdate)
    return () => {
      ydoc.off('update', onUpdate)
      clearTimeout(idleTimer)
      provider.awareness.setLocalStateField('typing', false)
    }
  }, [ydoc, provider])

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
  const avatarUrl = authUser?.avatar_url ?? null
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

    // Full identity in awareness — name + color for cursors, avatar_url for
    // the topbar avatar stack on every other connected client's screen.
    const awarenessPayload: AwarenessUser = {
      name: userName,
      color: cursorColor,
      avatar_url: avatarUrl,
    }

    const timeout = setTimeout(() => {
      if (provider.awareness) {
        provider.awareness.setLocalStateField('user', awarenessPayload)
        console.log(`[Awareness] Set for ${userName}`)
      }
    }, 250)

    provider.awareness.on('change', ({ added }: { added: number[] }) => {
      if (added.length > 0) {
        setTimeout(() => {
          provider.awareness.setLocalStateField('user', awarenessPayload)
        }, 500)
      }
    })

    setReadyProvider(provider)

    // ── Ghost cursor fix ───────────────────────────────────────────────────
    // useEffect cleanup does NOT fire on page refresh or tab close.
    // beforeunload fires synchronously before unload, giving us one last
    // chance to broadcast null awareness while the socket is still open.
    // The cleanup return fn handles normal SPA navigation (route changes).
    // setLocalState(null) must come BEFORE disconnect.
    // ──────────────────────────────────────────────────────────────────────
    const handleBeforeUnload = () => {
      provider.awareness.setLocalState(null)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      provider.awareness.setLocalState(null)
      provider.disconnect()
      provider.destroy()
      providerRef.current = null
      setReadyProvider(null)
      setWsStatus('connecting')
    }
  }, [tokenData, snapshotData, documentId, userName, cursorColor, avatarUrl])

  // Keep awareness in sync if name/color/avatar changes mid-session
  useEffect(() => {
    if (!readyProvider) return
    readyProvider.awareness.setLocalStateField('user', {
      name: userName,
      color: cursorColor,
      avatar_url: avatarUrl,
    })
  }, [readyProvider, userName, cursorColor, avatarUrl])

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
        provider={readyProvider}
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