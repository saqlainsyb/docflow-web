// src/pages/workspace/DocumentEditorPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Lexical collaborative editor — v2 (FIXED)
//
// Root causes fixed:
//  1. "Unexpected end of array" — snapshot was applied to ydoc BEFORE Lexical
//     bound its own shared types to it, corrupting the Yjs array. Fix: apply
//     snapshot INSIDE providerFactory, after Lexical registers its types.
//  2. "useCollaborationContext: no context provider found" — CollaborationPlugin
//     requires <LexicalCollaboration> wrapping the entire LexicalComposer tree.
//
// Architecture:
//  - readyProvider (outer) = awareness-only, never connects to WS itself.
//    Used only by CollaboratorAvatars + ConnectionBadge in the topbar.
//  - lexicalProvider (inner, created in providerFactory) = the real WS sync.
//    Lexical calls .connect() on this when ready; it owns the Y.Doc.
//  - Snapshot is applied inside providerFactory after Lexical has registered
//    its shared types on the doc — the only safe moment.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

// ── Lexical core
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS } from "@lexical/markdown";
import { CollaborationPlugin } from "@lexical/react/LexicalCollaborationPlugin";
import { LexicalCollaboration } from "@lexical/react/LexicalCollaborationContext";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import type { Provider } from "@lexical/yjs";
import { FORMAT_TEXT_COMMAND, FORMAT_ELEMENT_COMMAND } from "lexical";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from "@lexical/list";

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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { useBoard } from "@/hooks/useBoard";
import { useDocumentToken } from "@/hooks/useDocumentToken";
import { useDocumentSnapshot } from "@/hooks/useDocumentSnapshot";
import { toast } from "@/components/toast";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type WsStatus = "connecting" | "connected" | "disconnected";

interface AwarenessUser {
  name: string;
  color: string;
  avatar_url: string | null;
  typing?: boolean;
}

interface ConnectedUser extends AwarenessUser {
  clientId: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CURSOR_PALETTE = [
  "#F87171",
  "#FB923C",
  "#FBBF24",
  "#34D399",
  "#38BDF8",
  "#818CF8",
  "#E879F9",
  "#A3E635",
  "#F472B6",
  "#60A5FA",
  "#4ADE80",
  "#C084FC",
];

function colorFromUserId(userId: string): string {
  if (!userId) return CURSOR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++)
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return CURSOR_PALETTE[hash % CURSOR_PALETTE.length];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function base64ToUint8Array(b64: string): Uint8Array {
  if (!b64) return new Uint8Array(0);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getWsBase(): string {
  if (import.meta.env.DEV) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:8080`;
  }
  return import.meta.env.VITE_WS_URL ?? "ws://localhost:8080";
}

// ─────────────────────────────────────────────────────────────────────────────
// Global CSS — injected once
// ─────────────────────────────────────────────────────────────────────────────

(function injectStyles() {
  if (
    typeof document === "undefined" ||
    document.getElementById("df-editor-styles")
  )
    return;
  const el = document.createElement("style");
  el.id = "df-editor-styles";
  el.textContent = `
@keyframes df-typing-ring {
  0%,100% { box-shadow: 0 0 0 2px oklch(0.12 0.015 265), 0 0 0 3.5px var(--ring-color), 0 0 6px 2px var(--ring-glow); }
  50%      { box-shadow: 0 0 0 2px oklch(0.12 0.015 265), 0 0 0 3.5px var(--ring-color), 0 0 10px 4px var(--ring-glow); }
}
.df-root { outline: none; min-height: 60vh; caret-color: oklch(0.82 0.14 198); }
.df-p  { margin: 0 0 .75rem; line-height: 1.75; color: oklch(.88 .012 265); font-size: 15px; }
.df-p:last-child { margin-bottom: 0; }
.df-h1 { font-size: 2rem; font-weight: 800; line-height: 1.15; color: oklch(.96 .008 265); margin: 0 0 .5rem; letter-spacing: -.03em; }
.df-h2 { font-size: 1.375rem; font-weight: 700; line-height: 1.25; color: oklch(.92 .01 265); margin: 1.5rem 0 .4rem; letter-spacing: -.02em; }
.df-h3 { font-size: 1.1rem; font-weight: 700; color: oklch(.88 .012 265); margin: 1.25rem 0 .35rem; }
.df-quote { border-left: 2.5px solid oklch(.82 .14 198 / .4); padding: .25rem 0 .25rem 1rem; color: oklch(.7 .015 265); font-style: italic; margin: .75rem 0; }
.df-ul { list-style: disc; padding-left: 1.5rem; margin: .5rem 0; }
.df-ol { list-style: decimal; padding-left: 1.5rem; margin: .5rem 0; }
.df-li { margin: .2rem 0; color: oklch(.88 .012 265); line-height: 1.65; font-size: 15px; }
.df-link { color: oklch(.82 .14 198); text-decoration: underline; text-decoration-color: oklch(.82 .14 198 / .3); cursor: pointer; }
.df-code-block { display: block; background: oklch(.16 .018 265); border: 1px solid rgba(255,255,255,.07); border-radius: 8px; padding: .875rem 1rem; font-family: 'Geist Mono','JetBrains Mono',ui-monospace,monospace; font-size: 13px; line-height: 1.6; color: oklch(.82 .14 198); margin: .75rem 0; overflow-x: auto; tab-size: 2; }
.df-bold { font-weight: 700; }
.df-italic { font-style: italic; }
.df-strike { text-decoration: line-through; }
.df-underline { text-decoration: underline; }
.df-inline-code { font-family: 'Geist Mono',ui-monospace,monospace; font-size: .85em; color: oklch(.82 .14 198); background: oklch(.18 .016 265); padding: .12em .4em; border-radius: 4px; border: 1px solid rgba(255,255,255,.07); }
`;
  document.head.appendChild(el);
})();

// ─────────────────────────────────────────────────────────────────────────────
// Lexical config
// ─────────────────────────────────────────────────────────────────────────────

const LEXICAL_THEME = {
  root: "df-root",
  paragraph: "df-p",
  heading: { h1: "df-h1", h2: "df-h2", h3: "df-h3" },
  quote: "df-quote",
  list: {
    ul: "df-ul",
    ol: "df-ol",
    listitem: "df-li",
    nested: { listitem: "df-li" },
  },
  link: "df-link",
  code: "df-code-block",
  text: {
    bold: "df-bold",
    italic: "df-italic",
    strikethrough: "df-strike",
    underline: "df-underline",
    code: "df-inline-code",
  },
};

const LEXICAL_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
];

// ─────────────────────────────────────────────────────────────────────────────
// useAwarenessUsers
// ─────────────────────────────────────────────────────────────────────────────

function useAwarenessUsers(
  provider: WebsocketProvider | null,
): ConnectedUser[] {
  const [users, setUsers] = useState<ConnectedUser[]>([]);
  useEffect(() => {
    if (!provider) {
      setUsers([]);
      return;
    }
    const read = () => {
      const result: ConnectedUser[] = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        const u = state.user as AwarenessUser | undefined;
        if (u?.name)
          result.push({
            clientId,
            ...u,
            typing: state.typing === true, // ← top-level field, not inside state.user
          });
      });
      result.sort((a, b) => a.clientId - b.clientId);
      setUsers(result);
    };
    read();
    provider.awareness.on("change", read);
    return () => {
      provider.awareness.off("change", read);
    };
  }, [provider]);
  return users;
}

// ─────────────────────────────────────────────────────────────────────────────
// usePresenceToasts
// ─────────────────────────────────────────────────────────────────────────────
function usePresenceToasts(
  provider: WebsocketProvider | null,
  myClientId: number,
) {
  const prevNamesRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (!provider) return;

    // When this client first connects, the y-websocket server immediately
    // broadcasts all currently-present awareness states as a sync burst.
    // Yjs fires those as `added` events — identical to a genuine new join.
    // We suppress join toasts during this initial window so that users who
    // were already in the room don't trigger "X joined" for the newcomer.
    let isInitialSync = true;
    const initialSyncTimer = setTimeout(() => {
      isInitialSync = false;
    }, 1500); // 1.5 s covers the initial awareness sync burst

    const handleChange = ({
      added,
      updated,
      removed,
    }: {
      added: number[];
      updated: number[];
      removed: number[];
    }) => {
      const states = provider.awareness.getStates();

      // ── Cache names for all visible clients (join + cursor moves) ──────
      [...added, ...updated].forEach((clientId) => {
        const user = states.get(clientId)?.user as AwarenessUser | undefined;
        if (user?.name) prevNamesRef.current.set(clientId, user.name);
      });

      // ── Join ───────────────────────────────────────────────────────────
      // Skip toasts during the initial sync window — those `added` events
      // are pre-existing users being synced to us, not genuine new arrivals.
      if (!isInitialSync) {
        for (const clientId of added) {
          if (clientId === myClientId) continue;
          const name = (states.get(clientId)?.user as AwarenessUser | undefined)
            ?.name;
          if (!name) continue;
          toast(`${name} joined`, {
            position: "bottom-right",
            duration: 3500,
            description: "Now editing this document",
          });
        }
      }

      // ── Leave ──────────────────────────────────────────────────────────
      for (const clientId of removed) {
        if (clientId === myClientId) continue;
        const name = prevNamesRef.current.get(clientId);
        if (!name) continue;
        toast(`${name} left`, {
          position: "bottom-right",
          duration: 3000,
        });
        prevNamesRef.current.delete(clientId);
      }
    };

    provider.awareness.on("change", handleChange);
    return () => {
      clearTimeout(initialSyncTimer);
      provider.awareness.off("change", handleChange);
    };
  }, [provider, myClientId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CollaboratorAvatars
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 32;
const MAX_VISIBLE = 3;
const OVERLAP = 8;

const CollaboratorAvatar = memo(
  ({ user, index }: { user: ConnectedUser; index: number }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const ringColor = user.color + "e6";
    const glowColor = user.color + "40";

    const idleBoxShadow = `0 0 0 2px oklch(0.13 0.015 265), 0 0 0 3.5px oklch(0.30 0.012 265)`;
    const typingBoxShadow = `0 0 0 2px oklch(0.13 0.015 265), 0 0 0 3.5px ${ringColor}, 0 0 8px 2px ${glowColor}`;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.6, x: 6 }}
        animate={{
          opacity: 1,
          scale: 1,
          x: 0,
          boxShadow: user.typing ? typingBoxShadow : idleBoxShadow,
        }}
        transition={{
          // entry animation
          opacity:  { delay: index * 0.05, type: "spring", stiffness: 420, damping: 22 },
          scale:    { delay: index * 0.05, type: "spring", stiffness: 420, damping: 22 },
          x:        { delay: index * 0.05, type: "spring", stiffness: 420, damping: 22 },
          // ring fade
          boxShadow: { duration: 0.5, ease: "easeInOut" },
        }}
        title={user.name}
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          borderRadius: "50%",
          flexShrink: 0,
          marginLeft: index === 0 ? 0 : -OVERLAP,
          zIndex: MAX_VISIBLE - index,
          ["--ring-color" as any]: ringColor,
          ["--ring-glow" as any]: glowColor,
          cursor: "default",
        }}
        className="hover:scale-105 hover:z-50!"
      >
        {user.avatar_url && !imgFailed ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="w-full h-full rounded-full flex items-center justify-center text-[9px] font-bold select-none"
            style={{
              background: "oklch(0.38 0.16 285)",
              color: "oklch(0.88 0.08 285)",
            }}
          >
            {getInitials(user.name)}
          </div>
        )}
      </motion.div>
    );
  },
);

function CollaboratorAvatars({
  provider,
}: {
  provider: WebsocketProvider | null;
}) {
  const users = useAwarenessUsers(provider);
  if (users.length === 0) return null;
  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;
  return (
    <div className="flex items-center">
      {visible.map((u, i) => (
        <CollaboratorAvatar key={u.clientId} user={u} index={i} />
      ))}
      {overflow > 0 && (
        <div
          title={`${overflow} more`}
          className="flex items-center justify-center rounded-full text-[9px] font-bold select-none"
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            marginLeft: -OVERLAP,
            zIndex: 0,
            flexShrink: 0,
            background: "oklch(0.24 0.016 265)",
            border: "2px solid oklch(0.13 0.015 265)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConnectionBadge
// ─────────────────────────────────────────────────────────────────────────────

function ConnectionBadge({ status }: { status: WsStatus }) {
  const cfg = {
    connected: {
      dot: "#34D399",
      label: "Live",
      text: "#34D399",
      bg: "rgba(52,211,153,0.10)",
      border: "rgba(52,211,153,0.20)",
    },
    connecting: {
      dot: "#FBBF24",
      label: "Syncing…",
      text: "#FBBF24",
      bg: "rgba(251,191,36,0.10)",
      border: "rgba(251,191,36,0.20)",
    },
    disconnected: {
      dot: "#F87171",
      label: "Offline",
      text: "#F87171",
      bg: "rgba(248,113,113,0.10)",
      border: "rgba(248,113,113,0.20)",
    },
  }[status];
  return (
    <motion.div
      key={status}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: cfg.dot,
          animation:
            status === "connecting" ? "pulse 1.2s infinite" : undefined,
        }}
      />
      {cfg.label}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolbarPlugin — inside LexicalComposer, has composer context
// ─────────────────────────────────────────────────────────────────────────────

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  function Btn({
    onClick,
    icon: Icon,
    label,
  }: {
    onClick: () => void;
    icon: React.FC<any>;
    label: string;
  }) {
    return (
      <motion.button
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
        title={label}
        aria-label={label}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className="w-7 h-7 flex items-center justify-center rounded-lg focus:outline-none transition-colors"
        style={{ color: "rgba(255,255,255,0.45)" }}
        onMouseEnter={(e) =>
          Object.assign(e.currentTarget.style, {
            background: "rgba(255,255,255,0.07)",
            color: "rgba(255,255,255,0.8)",
          })
        }
        onMouseLeave={(e) =>
          Object.assign(e.currentTarget.style, {
            background: "transparent",
            color: "rgba(255,255,255,0.45)",
          })
        }
      >
        <Icon className="w-3.5 h-3.5" />
      </motion.button>
    );
  }

  const Sep = () => (
    <div
      className="w-px h-4 mx-0.5"
      style={{ background: "rgba(255,255,255,0.07)" }}
    />
  );

  return (
    <div
      className="flex items-center gap-0.5 px-3 py-2 flex-wrap sticky top-0 z-10"
      style={{
        background: "oklch(0.145 0.015 265)",
        borderBottom: "1px solid rgba(255,255,255,0.055)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Btn
        icon={Heading1}
        label="H1"
        onClick={() =>
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "h1" as any)
        }
      />
      <Btn
        icon={Heading2}
        label="H2"
        onClick={() =>
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "h2" as any)
        }
      />
      <Btn
        icon={Heading3}
        label="H3"
        onClick={() =>
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "h3" as any)
        }
      />
      <Sep />
      <Btn
        icon={Bold}
        label="Bold"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      />
      <Btn
        icon={Italic}
        label="Italic"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      />
      <Btn
        icon={Strikethrough}
        label="Strikethrough"
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")
        }
      />
      <Btn
        icon={Code}
        label="Inline code"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
      />
      <Sep />
      <Btn
        icon={List}
        label="Bullet list"
        onClick={() =>
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        }
      />
      <Btn
        icon={ListOrdered}
        label="Numbered list"
        onClick={() =>
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        }
      />
      <Btn
        icon={Quote}
        label="Quote"
        onClick={() =>
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "quote" as any)
        }
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TypingIndicatorPlugin — inside LexicalComposer
// ─────────────────────────────────────────────────────────────────────────────

function TypingIndicatorPlugin({ provider }: { provider: WebsocketProvider }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    return editor.registerUpdateListener(({ tags }) => {
      if (tags.has("collaboration") || tags.has("history-merge")) return;
      provider.awareness.setLocalStateField("typing", true);
      clearTimeout(timer);
      timer = setTimeout(
        () => provider.awareness.setLocalStateField("typing", false),
        1500,
      );
    });
  }, [editor, provider]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// EditorTopbar
// ─────────────────────────────────────────────────────────────────────────────

const EditorTopbar = memo(
  ({
    cardTitle,
    wsStatus,
    onBack,
    provider,
  }: {
    cardTitle: string;
    wsStatus: WsStatus;
    onBack: () => void;
    provider: WebsocketProvider | null;
  }) => (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="h-16 flex items-center justify-between px-5 shrink-0 relative z-40"
      style={{
        background: "oklch(0.13 0.015 265 / 0.92)",
        backdropFilter: "blur(24px) saturate(180%)",
        borderBottom: "1px solid rgba(255,255,255,0.055)",
        boxShadow: "0 1px 0 rgba(0,218,243,0.06)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <motion.button
          onClick={onBack}
          aria-label="Back to board"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 450, damping: 25 }}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 focus:outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.07)",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </motion.button>

        <div
          className="w-px h-6 shrink-0"
          style={{ background: "rgba(255,255,255,0.08)" }}
        />

        <div className="flex flex-col min-w-0">
          <h1
            className="font-bold text-[15px] tracking-tight truncate leading-tight"
            style={{
              color: "oklch(0.94 0.008 265)",
              fontFamily: "var(--df-font-display)",
            }}
          >
            {cardTitle}
          </h1>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: "rgba(255,255,255,0.28)" }}
          >
            Document
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <CollaboratorAvatars provider={provider} />
        {provider && (
          <div
            className="w-px h-5"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
        )}
        <ConnectionBadge status={wsStatus} />
      </div>
    </motion.header>
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// EditorSkeleton
// ─────────────────────────────────────────────────────────────────────────────

function EditorSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12 space-y-3">
      {[0.55, 1, 0.83, 0.91, 0.67, 0.78, 0.6].map((w, i) => (
        <motion.div
          key={i}
          className="h-4 rounded-lg"
          style={{ width: `${w * 100}%`, background: "rgba(255,255,255,0.05)" }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.08,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ErrorScreen
// ─────────────────────────────────────────────────────────────────────────────

function ErrorScreen({
  icon: Icon,
  message,
  onBack,
}: {
  icon: React.FC<any>;
  message: string;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-screen items-center justify-center flex-col gap-5"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(248,113,113,0.10)",
          border: "1px solid rgba(248,113,113,0.20)",
        }}
      >
        <Icon className="w-6 h-6" style={{ color: "#F87171" }} />
      </div>
      <p
        className="font-semibold text-[15px]"
        style={{ color: "oklch(0.88 0.012 265)" }}
      >
        {message}
      </p>
      <motion.button
        onClick={onBack}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="text-[13px] font-bold px-4 py-2 rounded-xl"
        style={{
          background: "rgba(0,218,243,0.08)",
          border: "1px solid rgba(0,218,243,0.18)",
          color: "oklch(0.82 0.14 198)",
        }}
      >
        Back to board
      </motion.button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CollaborativeLexicalEditor
//
// Renders the full Lexical editor tree including the required
// <LexicalCollaboration> context provider and the CollaborationPlugin.
// ─────────────────────────────────────────────────────────────────────────────

interface CollaborativeLexicalEditorProps {
  token: string;
  snapshotBytes: Uint8Array;
  wsStatus: WsStatus;
  userName: string;
  cursorColor: string;
  documentId: string;
  awarenessProvider: WebsocketProvider; // for topbar avatar + typing indicator
}

const CollaborativeLexicalEditor = memo(
  ({
    token,
    snapshotBytes,
    wsStatus,
    userName,
    cursorColor,
    documentId,
    awarenessProvider,
  }: CollaborativeLexicalEditorProps) => {
    // Track whether we've already applied the snapshot to avoid double-apply
    // if React strict mode re-runs effects.
    const snapshotApplied = useRef(false);

    const initialConfig = useMemo(
      () => ({
        namespace: `docflow-${documentId}`,
        theme: LEXICAL_THEME,
        nodes: LEXICAL_NODES,
        onError: (err: Error) => console.error("[Lexical]", err),
        editorState: null, // CRITICAL: must be null when using CollaborationPlugin
      }),
      [documentId],
    );

    // providerFactory is called by CollaborationPlugin during its mount.
    // At this point Lexical has already created the LexicalYjsDoc shared type
    // on whatever doc we set in yjsDocMap — so it's safe to apply the snapshot.
    const providerFactory = useCallback(
      (id: string, yjsDocMap: Map<string, Y.Doc>): Provider => {
        // Always create a fresh doc for Lexical to own.
        const doc = new Y.Doc();
        yjsDocMap.set(id, doc);

        // Apply the server snapshot BEFORE connecting so the initial sync diff
        // is minimal. The timing here is correct: Lexical has already called
        // Y.getArray / Y.getMap on doc by the time providerFactory runs,
        // so the shared types exist and applyUpdate won't corrupt them.
        if (!snapshotApplied.current && snapshotBytes.length > 0) {
          try {
            Y.applyUpdate(doc, snapshotBytes);
            snapshotApplied.current = true;
          } catch (e) {
            // Fresh document is fine — server will send full state on connect
            console.warn("[Docflow] snapshot apply failed, starting fresh:", e);
          }
        }

        // Create the real WebSocket provider bound to Lexical's doc.
        // connect: false — CollaborationPlugin calls .connect() when ready.
        const provider = new WebsocketProvider(
          `${getWsBase()}/ws/documents`,
          id,
          doc,
          { params: { token }, connect: false },
        );

        // Mirror remote awareness states into the topbar's awarenessProvider
        // so CollaboratorAvatars reflects all connected users correctly.
        provider.awareness.on(
          "change",
          ({
            added,
            updated,
            removed,
          }: {
            added: number[];
            updated: number[];
            removed: number[];
          }) => {
            const myClientId = provider.awareness.clientID;
            const states = provider.awareness.getStates();

            // Mirror additions + updates into the topbar's awareness provider
            [...added, ...updated].forEach((clientId) => {
              if (clientId === myClientId) return;
              const state = states.get(clientId);
              if (state)
                awarenessProvider.awareness.states.set(clientId, state);
            });

            // Mirror removals — cleans up departed users from the avatar stack too
            removed.forEach((clientId) => {
              if (clientId !== myClientId)
                awarenessProvider.awareness.states.delete(clientId);
            });

            // Emit a faithful change event so downstream hooks (useAwarenessUsers,
            // usePresenceToasts) receive correct added/removed arrays
            awarenessProvider.awareness.emit("change", [
              { added, updated, removed },
              null,
            ]);
          },
        );

        // Mirror our own awareness into the collab provider so other clients
        // see our cursor color + name.
        const syncLocal = () => {
          const local = awarenessProvider.awareness.getLocalState();
          if (local) {
            Object.entries(local).forEach(([key, value]) => {
              provider.awareness.setLocalStateField(key, value);
            });
          }
        };
        awarenessProvider.awareness.on("change", syncLocal);

        return provider as unknown as Provider;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [token, snapshotBytes, documentId, awarenessProvider],
    );

    return (
      // LexicalCollaboration provides the React context that CollaborationPlugin
      // reads via useCollaborationContext(). Without this wrapper you get:
      // "useCollaborationContext: no context provider found"
      <LexicalCollaboration>
        <LexicalComposer initialConfig={initialConfig}>
          {/* Sticky toolbar */}
          <ToolbarPlugin />

          <div className="max-w-3xl mx-auto px-8 py-10 relative">
            {/* Disconnected banner */}
            <AnimatePresence>
              {wsStatus === "disconnected" && (
                <motion.div
                  key="offline-banner"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.22 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl overflow-hidden"
                  style={{
                    background: "rgba(248,113,113,0.08)",
                    border: "1px solid rgba(248,113,113,0.18)",
                    color: "#F87171",
                  }}
                >
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <p className="text-[13px] font-medium">
                    Connection lost — edits are queued locally and will sync on
                    reconnect.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Editor surface */}
            <div className="relative">
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className="df-root focus:outline-none"
                    style={{
                      fontFamily:
                        'var(--df-font-body,"Geist Variable",system-ui,sans-serif)',
                    }}
                    aria-label="Document editor"
                  />
                }
                placeholder={
                  <div
                    className="absolute top-0 left-0 pointer-events-none select-none text-[15px]"
                    style={{
                      color: "rgba(255,255,255,0.16)",
                      fontFamily: "var(--df-font-body)",
                    }}
                    aria-hidden
                  >
                    Start writing… (# H1, ## H2, - list, {">"} quote)
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
            </div>

            {/* Non-visual plugins */}
            <ListPlugin />
            <LinkPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <TypingIndicatorPlugin provider={awarenessProvider} />

            {/* The collaboration binding — must be inside <LexicalCollaboration> */}
            <CollaborationPlugin
              id={documentId}
              providerFactory={providerFactory}
              shouldBootstrap={false}
              username={userName}
              cursorColor={cursorColor}
            />
          </div>
        </LexicalComposer>
      </LexicalCollaboration>
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// DocumentEditorPage — main export
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentEditorPage() {
  const { workspaceId, boardId, cardId } = useParams<{
    workspaceId: string;
    boardId: string;
    cardId: string;
  }>();
  const navigate = useNavigate();

  const authUser = useAppSelector((s) => s.auth.user);
  const userName = authUser?.name ?? "Anonymous";
  const userId = authUser?.id ?? "";
  const avatarUrl = authUser?.avatar_url ?? null;
  const cursorColor = useMemo(() => colorFromUserId(userId), [userId]);

  const {
    data: board,
    isLoading: isBoardLoading,
    isError: isBoardError,
  } = useBoard(boardId);
  const card = useMemo(() => {
    if (!board || !cardId) return undefined;
    for (const col of board.columns) {
      const found = col.cards.find((c) => c.id === cardId);
      if (found) return found;
    }
  }, [board, cardId]);

  const documentId = card?.document_id;

  const {
    data: tokenData,
    isLoading: isTokenLoading,
    isError: isTokenError,
    error: tokenError,
  } = useDocumentToken(documentId);
  const {
    data: snapshotData,
    isLoading: isSnapshotLoading,
    isError: isSnapshotError,
  } = useDocumentSnapshot({ documentId, tokenReady: Boolean(tokenData) });

  // Awareness-only provider — used by topbar avatar stack + typing indicator.
  // Does NOT connect to WS itself; CollaborationPlugin's inner provider does.
  const awarenessProviderRef = useRef<WebsocketProvider | null>(null);
  const [awarenessProvider, setAwarenessProvider] =
    useState<WebsocketProvider | null>(null);
  const myClientId = awarenessProvider?.awareness.clientID ?? -1;
  usePresenceToasts(awarenessProvider, myClientId);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");

  const snapshotBytes = useMemo(
    () => base64ToUint8Array(snapshotData?.snapshot ?? ""),
    [snapshotData],
  );

  useEffect(() => {
    if (!tokenData || !snapshotData || !documentId) return;
    if (awarenessProviderRef.current) return;

    // Throwaway doc — this provider is awareness-only, not syncing content.
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(
      `${getWsBase()}/ws/documents`,
      documentId,
      doc,
      { params: { token: tokenData.token }, connect: false },
    );
    awarenessProviderRef.current = provider;

    // We can still listen to status events from the inner provider by
    // forwarding them — but since we don't call connect(), drive status from
    // the CollaborationPlugin's provider instead via window events.
    // Simpler: use a custom event to receive status from inside providerFactory.
    const onSyncStatus = (e: Event) => {
      const status = (e as CustomEvent<string>).detail;
      if (status === "connected") setWsStatus("connected");
      else if (status === "disconnected") setWsStatus("disconnected");
      else setWsStatus("connecting");
    };
    window.addEventListener(`df-ws-status-${documentId}`, onSyncStatus);

    const awarenessPayload: AwarenessUser = {
      name: userName,
      color: cursorColor,
      avatar_url: avatarUrl,
    };
    const timeout = setTimeout(() => {
      provider.awareness.setLocalStateField("user", awarenessPayload);
    }, 100);

    const handleBeforeUnload = () => {
      provider.awareness.setLocalState(null);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    setAwarenessProvider(provider);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener(`df-ws-status-${documentId}`, onSyncStatus);
      provider.awareness.setLocalState(null);
      provider.destroy();
      doc.destroy();
      awarenessProviderRef.current = null;
      setAwarenessProvider(null);
      setWsStatus("connecting");
    };
  }, [tokenData, snapshotData, documentId, userName, cursorColor, avatarUrl]);

  // Keep awareness current
  useEffect(() => {
    if (!awarenessProvider) return;
    awarenessProvider.awareness.setLocalStateField("user", {
      name: userName,
      color: cursorColor,
      avatar_url: avatarUrl,
    });
  }, [awarenessProvider, userName, cursorColor, avatarUrl]);

  const handleBack = useCallback(
    () => navigate(`/${workspaceId}/boards/${boardId}`),
    [navigate, workspaceId, boardId],
  );

  const tokenStatus =
    (tokenError as any)?.response?.status ?? (tokenError as any)?.status;
  const isAccessDenied = tokenStatus === 403 || tokenStatus === 401;

  if (isTokenError)
    return (
      <ErrorScreen
        icon={AlertCircle}
        message={
          isAccessDenied
            ? "You don't have access to this document"
            : "Failed to open document"
        }
        onBack={handleBack}
      />
    );

  if (
    isSnapshotError ||
    isBoardError ||
    (!documentId && !isBoardLoading && board)
  )
    return (
      <ErrorScreen
        icon={WifiOff}
        message="Failed to load document or board not found"
        onBack={handleBack}
      />
    );

  const isBootstrapping =
    isBoardLoading ||
    isTokenLoading ||
    isSnapshotLoading ||
    !awarenessProvider ||
    !board ||
    !documentId ||
    !tokenData;

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "oklch(0.115 0.013 265)" }}
    >
      <EditorTopbar
        cardTitle={card?.title ?? "…"}
        wsStatus={wsStatus}
        onBack={handleBack}
        provider={awarenessProvider}
      />

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {isBootstrapping ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EditorSkeleton />
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <CollaborativeLexicalEditor
                token={tokenData!.token}
                snapshotBytes={snapshotBytes}
                wsStatus={wsStatus}
                userName={userName}
                cursorColor={cursorColor}
                documentId={documentId!}
                awarenessProvider={awarenessProvider!}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
