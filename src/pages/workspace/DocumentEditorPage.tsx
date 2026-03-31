// src/pages/workspace/DocumentEditorPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Lexical-powered collaborative document editor.
// Replaces TipTap while keeping the Yjs / y-websocket layer 100% intact.
//
// Dependencies to install:
//   npm install lexical @lexical/react @lexical/yjs @lexical/rich-text
//              @lexical/list @lexical/link @lexical/code @lexical/markdown
//              @lexical/history @lexical/selection @lexical/utils
//
// All existing hooks (useBoard, useDocumentToken, useDocumentSnapshot) and
// the WebsocketProvider setup are untouched — only the editor surface changes.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  memo,
} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

// ── Lexical core
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { TRANSFORMERS } from '@lexical/markdown'
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { LinkNode, AutoLinkNode } from '@lexical/link'
import { CodeNode, CodeHighlightNode } from '@lexical/code'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import type { EditorState } from 'lexical'

// ── Icons
import {
  ArrowLeft,
  WifiOff,
  AlertCircle,
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Minus,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { useBoard } from '@/hooks/useBoard'
import { useDocumentToken } from '@/hooks/useDocumentToken'
import { useDocumentSnapshot } from '@/hooks/useDocumentSnapshot'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WsStatus = 'connecting' | 'connected' | 'disconnected'

interface AwarenessUser {
  name: string
  color: string
  avatar_url: string | null
  typing?: boolean
}

interface ConnectedUser extends AwarenessUser {
  clientId: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function base64ToUint8Array(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(0)
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// ─────────────────────────────────────────────────────────────────────────────
// Typing animation styles (injected once)
// ─────────────────────────────────────────────────────────────────────────────

const TYPING_STYLE = `
@keyframes df-typing-ring {
  0%   { box-shadow: 0 0 0 2px oklch(0.12 0.015 265), 0 0 0 3.5px var(--ring-color), 0 0 6px 2px var(--ring-glow); }
  50%  { box-shadow: 0 0 0 2px oklch(0.12 0.015 265), 0 0 0 3.5px var(--ring-color), 0 0 10px 4px var(--ring-glow); }
  100% { box-shadow: 0 0 0 2px oklch(0.12 0.015 265), 0 0 0 3.5px var(--ring-color), 0 0 6px 2px var(--ring-glow); }
}
@keyframes df-caret-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
`
if (typeof document !== 'undefined' && !document.getElementById('df-editor-style')) {
  const el = document.createElement('style')
  el.id = 'df-editor-style'
  el.textContent = TYPING_STYLE
  document.head.appendChild(el)
}

// ─────────────────────────────────────────────────────────────────────────────
// Lexical theme — mirrors the dark BoardPage palette exactly
// ─────────────────────────────────────────────────────────────────────────────

const LEXICAL_THEME = {
  root: 'df-editor-root',
  paragraph: 'df-editor-p',
  heading: {
    h1: 'df-editor-h1',
    h2: 'df-editor-h2',
    h3: 'df-editor-h3',
  },
  quote: 'df-editor-quote',
  list: {
    ul: 'df-editor-ul',
    ol: 'df-editor-ol',
    listitem: 'df-editor-li',
    nested: {
      listitem: 'df-editor-li-nested',
    },
  },
  link: 'df-editor-link',
  code: 'df-editor-code',
  codeHighlight: {
    comment: 'df-code-comment',
    property: 'df-code-property',
    tag: 'df-code-tag',
    attr: 'df-code-attr',
    entity: 'df-code-entity',
    url: 'df-code-url',
    keyword: 'df-code-keyword',
    important: 'df-code-important',
    string: 'df-code-string',
    number: 'df-code-number',
    function: 'df-code-function',
    punctuation: 'df-code-punctuation',
    operator: 'df-code-operator',
    regex: 'df-code-regex',
  },
  text: {
    bold: 'df-editor-bold',
    italic: 'df-editor-italic',
    strikethrough: 'df-editor-strike',
    underline: 'df-editor-underline',
    code: 'df-editor-inline-code',
  },
  placeholder: 'df-editor-placeholder',
}

// Inject Lexical CSS into <head>
const LEXICAL_CSS = `
/* ── Lexical editor surface ── */
.df-editor-root {
  outline: none;
  min-height: 60vh;
  caret-color: oklch(0.82 0.14 198);
}
.df-editor-p {
  margin: 0 0 0.75rem;
  line-height: 1.75;
  color: oklch(0.88 0.012 265);
  font-size: 15px;
  font-family: var(--df-font-body, 'Geist Variable', system-ui, sans-serif);
}
.df-editor-p:last-child { margin-bottom: 0; }
.df-editor-h1 {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.15;
  color: oklch(0.96 0.008 265);
  margin: 0 0 0.5rem;
  letter-spacing: -0.03em;
  font-family: var(--df-font-display, 'Manrope Variable', system-ui, sans-serif);
}
.df-editor-h2 {
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.25;
  color: oklch(0.92 0.01 265);
  margin: 1.5rem 0 0.4rem;
  letter-spacing: -0.02em;
  font-family: var(--df-font-display, 'Manrope Variable', system-ui, sans-serif);
}
.df-editor-h3 {
  font-size: 1.1rem;
  font-weight: 700;
  color: oklch(0.88 0.012 265);
  margin: 1.25rem 0 0.35rem;
  letter-spacing: -0.015em;
  font-family: var(--df-font-display, 'Manrope Variable', system-ui, sans-serif);
}
.df-editor-quote {
  border-left: 2.5px solid oklch(0.82 0.14 198 / 0.4);
  padding: 0.25rem 0 0.25rem 1rem;
  color: oklch(0.7 0.015 265);
  font-style: italic;
  margin: 0.75rem 0;
}
.df-editor-ul {
  list-style: disc;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
.df-editor-ol {
  list-style: decimal;
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
.df-editor-li {
  margin: 0.2rem 0;
  color: oklch(0.88 0.012 265);
  line-height: 1.65;
  font-size: 15px;
}
.df-editor-li-nested { list-style-type: circle; }
.df-editor-link {
  color: oklch(0.82 0.14 198);
  text-decoration: underline;
  text-decoration-color: oklch(0.82 0.14 198 / 0.3);
  cursor: pointer;
}
.df-editor-code {
  display: block;
  background: oklch(0.16 0.018 265);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  padding: 0.875rem 1rem;
  font-family: 'Geist Mono', 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: oklch(0.82 0.14 198);
  margin: 0.75rem 0;
  overflow-x: auto;
  tab-size: 2;
}
.df-editor-inline-code {
  font-family: 'Geist Mono', monospace;
  font-size: 0.85em;
  color: oklch(0.82 0.14 198);
  background: oklch(0.18 0.016 265);
  padding: 0.12em 0.4em;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.07);
}
.df-editor-bold { font-weight: 700; }
.df-editor-italic { font-style: italic; }
.df-editor-strike { text-decoration: line-through; }
.df-editor-underline { text-decoration: underline; }
/* Code highlight colors */
.df-code-comment { color: oklch(0.6 0.02 265); font-style: italic; }
.df-code-property, .df-code-function { color: oklch(0.78 0.14 230); }
.df-code-tag { color: oklch(0.75 0.16 15); }
.df-code-attr { color: oklch(0.78 0.12 160); }
.df-code-string { color: oklch(0.78 0.14 150); }
.df-code-keyword, .df-code-important { color: oklch(0.72 0.18 300); }
.df-code-number { color: oklch(0.82 0.12 55); }
.df-code-punctuation, .df-code-operator { color: oklch(0.7 0.04 265); }
/* Collaborative cursors */
.collaboration-cursor__caret {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 2px solid;
  word-break: normal;
  pointer-events: none;
}
.collaboration-cursor__label {
  position: absolute;
  top: -1.6em;
  left: -1px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px 3px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
  color: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
}
`
if (typeof document !== 'undefined' && !document.getElementById('df-lexical-css')) {
  const el = document.createElement('style')
  el.id = 'df-lexical-css'
  el.textContent = LEXICAL_CSS
  document.head.appendChild(el)
}

// ─────────────────────────────────────────────────────────────────────────────
// Lexical nodes list
// ─────────────────────────────────────────────────────────────────────────────

const LEXICAL_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
]

// ─────────────────────────────────────────────────────────────────────────────
// useAwarenessUsers — identical to original, no changes needed
// ─────────────────────────────────────────────────────────────────────────────

function useAwarenessUsers(provider: WebsocketProvider | null): ConnectedUser[] {
  const [users, setUsers] = useState<ConnectedUser[]>([])

  useEffect(() => {
    if (!provider) { setUsers([]); return }

    const read = () => {
      const states = provider.awareness.getStates()
      const result: ConnectedUser[] = []
      states.forEach((state, clientId) => {
        const u = state.user as AwarenessUser | undefined
        if (u?.name) result.push({ clientId, ...u })
      })
      result.sort((a, b) => a.clientId - b.clientId)
      setUsers(result)
    }

    read()
    provider.awareness.on('change', read)
    return () => { provider.awareness.off('change', read) }
  }, [provider])

  return users
}

// ─────────────────────────────────────────────────────────────────────────────
// CollaboratorAvatar — memo to prevent re-renders from awareness ticks
// ─────────────────────────────────────────────────────────────────────────────

const MAX_VISIBLE = 3
const AVATAR_SIZE = 32
const OVERLAP = 8

const CollaboratorAvatar = memo(function CollaboratorAvatar({
  user, index,
}: { user: ConnectedUser; index: number }) {
  const [imgFailed, setImgFailed] = useState(false)
  const ringColor = user.color + 'e6'
  const glowColor = user.color + '59'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, x: 6 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 420, damping: 22 }}
      title={user.name}
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: '50%',
        flexShrink: 0,
        marginLeft: index === 0 ? 0 : -OVERLAP,
        zIndex: MAX_VISIBLE - index,
        ['--ring-color' as any]: ringColor,
        ['--ring-glow' as any]: glowColor,
        boxShadow: user.typing
          ? undefined
          : `0 0 0 2px oklch(0.13 0.015 265), 0 0 0 3.5px ${ringColor}`,
        animation: user.typing ? 'df-typing-ring 1.2s ease-in-out infinite' : 'none',
        cursor: 'default',
        transition: 'transform 0.15s ease',
      }}
      className="hover:scale-105 hover:z-50!"
    >
      {user.avatar_url && !imgFailed ? (
        <img
          src={user.avatar_url}
          alt={user.name}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center text-[9px] font-bold select-none"
          style={{
            background: 'oklch(0.38 0.16 285)',
            color: 'oklch(0.88 0.08 285)',
          }}
        >
          {getInitials(user.name)}
        </div>
      )}
    </motion.div>
  )
})

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
        <div
          className="flex items-center justify-center rounded-full text-[9px] font-bold select-none cursor-default"
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            marginLeft: -OVERLAP,
            zIndex: 0,
            flexShrink: 0,
            background: 'oklch(0.24 0.016 265)',
            border: '2px solid oklch(0.13 0.015 265)',
            color: 'rgba(255,255,255,0.5)',
          }}
          title={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConnectionBadge — matches BoardPage accent style
// ─────────────────────────────────────────────────────────────────────────────

function ConnectionBadge({ status }: { status: WsStatus }) {
  const configs = {
    connected: { dot: '#34D399', label: 'Live', text: '#34D399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.20)' },
    connecting: { dot: '#FBBF24', label: 'Syncing…', text: '#FBBF24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.20)' },
    disconnected: { dot: '#F87171', label: 'Offline', text: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.20)' },
  }
  const c = configs[status]

  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: c.dot,
          boxShadow: status === 'connecting' ? `0 0 6px 2px ${c.dot}` : undefined,
          animation: status === 'connecting' ? 'pulse 1.2s infinite' : undefined,
        }}
      />
      {c.label}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar — floating format toolbar rendered ABOVE the editor surface
// ─────────────────────────────────────────────────────────────────────────────

// Inner toolbar that can access the Lexical composer context
function ToolbarInner() {
  const [editor] = useLexicalComposerContext()

  const format = useCallback((cmd: string, ...args: any[]) => {
    editor.dispatchCommand(cmd as any, ...args)
  }, [editor])

  const ToolbarBtn = useCallback(({
    onClick, icon: Icon, label, active = false,
  }: {
    onClick: () => void
    icon: React.FC<any>
    label: string
    active?: boolean
  }) => (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      title={label}
      aria-label={label}
      className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors focus:outline-none"
      style={{
        background: active ? 'rgba(0,218,243,0.15)' : 'transparent',
        border: active ? '1px solid rgba(0,218,243,0.22)' : '1px solid transparent',
        color: active ? 'oklch(0.82 0.14 198)' : 'rgba(255,255,255,0.45)',
      }}
    >
      <Icon className="w-3.5 h-3.5" />
    </motion.button>
  ), [])

  const Divider = () => (
    <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
  )

  // NOTE: For a production build, you'd track selection state via
  // editor.registerUpdateListener + $getSelection to show active states.
  // This toolbar wires commands; the pattern is the same for all Lexical setups.
  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5"
      style={{
        background: 'linear-gradient(160deg, oklch(0.175 0.018 265) 0%, oklch(0.155 0.014 265) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
      }}
    >
      {/* Headings */}
      <ToolbarBtn
        icon={Heading1}
        label="Heading 1"
        onClick={() => {
          const { FORMAT_ELEMENT_COMMAND } = require('lexical')
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'h1' as any)
        }}
      />
      <ToolbarBtn
        icon={Heading2}
        label="Heading 2"
        onClick={() => {
          const { FORMAT_ELEMENT_COMMAND } = require('lexical')
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'h2' as any)
        }}
      />
      <ToolbarBtn
        icon={Heading3}
        label="Heading 3"
        onClick={() => {
          const { FORMAT_ELEMENT_COMMAND } = require('lexical')
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'h3' as any)
        }}
      />

      <Divider />

      {/* Inline text */}
      <ToolbarBtn
        icon={Bold}
        label="Bold"
        onClick={() => {
          const { FORMAT_TEXT_COMMAND } = require('lexical')
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
        }}
      />
      <ToolbarBtn
        icon={Italic}
        label="Italic"
        onClick={() => {
          const { FORMAT_TEXT_COMMAND } = require('lexical')
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
        }}
      />
      <ToolbarBtn
        icon={Strikethrough}
        label="Strikethrough"
        onClick={() => {
          const { FORMAT_TEXT_COMMAND } = require('lexical')
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
        }}
      />
      <ToolbarBtn
        icon={Code}
        label="Inline code"
        onClick={() => {
          const { FORMAT_TEXT_COMMAND } = require('lexical')
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
        }}
      />

      <Divider />

      {/* Block */}
      <ToolbarBtn
        icon={List}
        label="Bullet list"
        onClick={() => {
          const { INSERT_UNORDERED_LIST_COMMAND } = require('@lexical/list')
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        }}
      />
      <ToolbarBtn
        icon={ListOrdered}
        label="Numbered list"
        onClick={() => {
          const { INSERT_ORDERED_LIST_COMMAND } = require('@lexical/list')
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        }}
      />
      <ToolbarBtn
        icon={Quote}
        label="Quote"
        onClick={() => {
          const { FORMAT_ELEMENT_COMMAND } = require('lexical')
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'quote' as any)
        }}
      />
      <ToolbarBtn
        icon={Minus}
        label="Divider"
        onClick={() => {
          const { INSERT_HORIZONTAL_RULE_COMMAND } = require('@lexical/react/LexicalHorizontalRuleNode')
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorTopbar — matches BoardPage topbar exactly
// ─────────────────────────────────────────────────────────────────────────────

const EditorTopbar = memo(function EditorTopbar({ cardTitle, wsStatus, onBack, provider }: {
  cardTitle: string
  wsStatus: WsStatus
  onBack: () => void
  provider: WebsocketProvider | null
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="h-16 flex items-center justify-between px-5 shrink-0 relative z-40"
      style={{
        background: 'oklch(0.13 0.015 265 / 0.88)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
        boxShadow: '0 1px 0 rgba(0,218,243,0.06)',
      }}
    >
      {/* Left: back + title */}
      <div className="flex items-center gap-3 min-w-0">
        <motion.button
          onClick={onBack}
          aria-label="Back to board"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-on-surface-variant focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </motion.button>

        <div className="w-px h-6 bg-white/8 shrink-0" />

        <div className="flex flex-col min-w-0">
          <h1
            className="font-bold text-[15px] tracking-tight text-on-surface truncate leading-tight"
            style={{ fontFamily: 'var(--df-font-display)' }}
          >
            {cardTitle}
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Document
          </p>
        </div>
      </div>

      {/* Right: avatars + status */}
      <div className="flex items-center gap-3 shrink-0">
        <CollaboratorAvatars provider={provider} />
        {provider && <div className="w-px h-5 bg-white/8" />}
        <ConnectionBadge status={wsStatus} />
      </div>
    </motion.header>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// EditorSkeleton
// ─────────────────────────────────────────────────────────────────────────────

function EditorSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
      {[0.75, 1, 0.83, 0.91, 0.67].map((w, i) => (
        <motion.div
          key={i}
          className="h-4 rounded-lg"
          style={{
            width: `${w * 100}%`,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 100%)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: i * 0.1 }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ErrorScreen
// ─────────────────────────────────────────────────────────────────────────────

function ErrorScreen({ icon: Icon, message, onBack }: {
  icon: React.FC<any>
  message: string
  onBack: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-screen items-center justify-center flex-col gap-5"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.20)' }}
      >
        <Icon className="w-6 h-6" style={{ color: '#F87171' }} />
      </div>
      <p className="text-on-surface font-semibold text-[15px]">{message}</p>
      <motion.button
        onClick={onBack}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="text-[13px] font-bold px-4 py-2 rounded-xl"
        style={{
          background: 'rgba(0,218,243,0.08)',
          border: '1px solid rgba(0,218,243,0.18)',
          color: 'oklch(0.82 0.14 198)',
        }}
      >
        Back to board
      </motion.button>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CollaborativeLexicalEditor
// Wraps LexicalComposer + all plugins. Provider is stable by the time this
// mounts so there are no Yjs reconnect/teardown issues.
// ─────────────────────────────────────────────────────────────────────────────

interface CollaborativeLexicalEditorProps {
  provider: WebsocketProvider
  ydoc: Y.Doc
  wsStatus: WsStatus
  userName: string
  cursorColor: string
  documentId: string
}

// Typing indicator plugin — wires ydoc → awareness like the TipTap version
function TypingIndicatorPlugin({
  ydoc,
  provider,
}: {
  ydoc: Y.Doc
  provider: WebsocketProvider
}) {
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>

    const onUpdate = (_: Uint8Array, _origin: any, transaction: any) => {
      if (!transaction?.local) return
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

  return null
}

const CollaborativeLexicalEditor = memo(function CollaborativeLexicalEditor({
  provider,
  ydoc,
  wsStatus,
  userName,
  cursorColor,
  documentId,
}: CollaborativeLexicalEditorProps) {
  const initialConfig = useMemo(() => ({
    namespace: `docflow-${documentId}`,
    theme: LEXICAL_THEME,
    nodes: LEXICAL_NODES,
    onError: (err: Error) => console.error('[Lexical]', err),
    // Editor state will be loaded from Yjs doc via CollaborationPlugin
    editorState: null,
  // documentId is stable for the lifetime of this mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [documentId])

  return (
    <LexicalComposer initialConfig={initialConfig}>
      {/* Toolbar sits inside the Composer so it has context access */}
      <ToolbarInner />

      <div className="relative px-8 py-10 max-w-3xl mx-auto">
        {/* Disconnected banner */}
        <AnimatePresence>
          {wsStatus === 'disconnected' && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.22 }}
              className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl overflow-hidden"
              style={{
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.18)',
                color: '#F87171',
              }}
            >
              <WifiOff className="w-4 h-4 shrink-0" />
              <p className="text-[13px] font-medium">
                Connection lost — edits are queued locally and will sync on reconnect.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor content area */}
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="df-editor-root focus:outline-none"
                style={{ minHeight: '60vh' }}
                aria-label="Document editor"
              />
            }
            placeholder={
              <div
                className="absolute top-0 left-0 pointer-events-none select-none text-[15px]"
                style={{ color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--df-font-body)' }}
                aria-hidden="true"
              >
                Start writing… (# for headings, * for lists)
              </div>
            }
            ErrorBoundary={({ children }: any) => children}
          />
        </div>

        {/* Plugins — no UI output */}
        <HistoryPlugin />
        <AutoFocusPlugin />
        <ListPlugin />
        <LinkPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <TypingIndicatorPlugin ydoc={ydoc} provider={provider} />

        {/* Yjs collaboration — this is the core binding */}
        <CollaborationPlugin
          id={documentId}
          providerFactory={(id, yjsDocMap) => {
            // Reuse the already-connected provider; map its doc
            yjsDocMap.set(id, ydoc)
            return provider as any
          }}
          shouldBootstrap={false}
          username={userName}
          cursorColor={cursorColor}
          cursorsContainerRef={undefined}
        />
      </div>
    </LexicalComposer>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// DocumentEditorPage — main export, all WS / auth logic unchanged from TipTap
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentEditorPage() {
  const { workspaceId, boardId, cardId } = useParams<{
    workspaceId: string
    boardId: string
    cardId: string
  }>()
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

  const {
    data: tokenData,
    isLoading: isTokenLoading,
    isError: isTokenError,
    error: tokenError,
  } = useDocumentToken(documentId)

  const {
    data: snapshotData,
    isLoading: isSnapshotLoading,
    isError: isSnapshotError,
  } = useDocumentSnapshot({ documentId, tokenReady: Boolean(tokenData) })

  // ── Yjs + WS setup (100% identical to TipTap version) ─────────────────────
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
      if (status === 'connected') setWsStatus('connected')
      if (status === 'connecting') setWsStatus('connecting')
      if (status === 'disconnected') setWsStatus('disconnected')
    })
    provider.on('connection-error', (err: any) => console.error('[WS Error]', err))
    provider.connect()

    const awarenessPayload: AwarenessUser = {
      name: userName,
      color: cursorColor,
      avatar_url: avatarUrl,
    }

    const timeout = setTimeout(() => {
      if (provider.awareness) {
        provider.awareness.setLocalStateField('user', awarenessPayload)
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

    const handleBeforeUnload = () => { provider.awareness.setLocalState(null) }
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

  // Keep awareness current if name/color/avatar changes mid-session
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

  // ── Error states ───────────────────────────────────────────────────────────
  const tokenStatus = (tokenError as any)?.response?.status ?? (tokenError as any)?.status
  const isAccessDenied = tokenStatus === 403 || tokenStatus === 401

  if (isTokenError) {
    return (
      <ErrorScreen
        icon={AlertCircle}
        message={isAccessDenied ? "You don't have access to this document" : 'Failed to open document'}
        onBack={handleBack}
      />
    )
  }

  if (isSnapshotError || isBoardError || (!documentId && !isBoardLoading && board)) {
    return (
      <ErrorScreen
        icon={WifiOff}
        message="Failed to load document or board not found"
        onBack={handleBack}
      />
    )
  }

  const isBootstrapping =
    isBoardLoading || isTokenLoading || isSnapshotLoading ||
    !readyProvider || !board || !documentId

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'oklch(0.115 0.013 265)' }}
    >
      <EditorTopbar
        cardTitle={card?.title ?? '…'}
        wsStatus={wsStatus}
        onBack={handleBack}
        provider={readyProvider}
      />

      {/* Editor scroll container */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {isBootstrapping ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <EditorSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="h-full"
            >
              <CollaborativeLexicalEditor
                provider={readyProvider!}
                ydoc={ydocRef.current}
                wsStatus={wsStatus}
                userName={userName}
                cursorColor={cursorColor}
                documentId={documentId!}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}