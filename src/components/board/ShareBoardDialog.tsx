// src/components/board/ShareBoardDialog.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Dialog for generating and revoking a board's public share link.
//
// canManage is derived from my_board_role (from BoardDetailResponse),
// passed directly by the caller. This is simpler and more reliable than
// searching the members array — the backend already resolved the effective
// board role server-side.
//
// board owner + admin → can manage share link
// editor             → read-only view of the dialog (no actions)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Link2,
  Copy,
  Check,
  Trash2,
  Globe,
  Loader2,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useGenerateShareLink } from '@/hooks/useGenerateShareLink'
import { useRevokeShareLink } from '@/hooks/useRevokeShareLink'
import type { BoardRole } from '@/lib/types'

// ── Design tokens ─────────────────────────────────────────────────────────────

const DIALOG_CONTENT_STYLE = {
  background:
    'linear-gradient(160deg, oklch(0.175 0.018 265) 0%, oklch(0.155 0.014 265) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 32px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
  borderRadius: '1.25rem',
}

const CYAN = 'oklch(0.82 0.14 198)'
const CYAN_DIM = 'oklch(0.82 0.14 198 / 0.60)'

// ── CopyField ─────────────────────────────────────────────────────────────────

function CopyField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('textarea')
      el.value = url
      el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [url])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
      style={{
        background: 'rgba(0,218,243,0.06)',
        border: '1px solid rgba(0,218,243,0.18)',
      }}
    >
      <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: CYAN_DIM }} />

      <span
        className="flex-1 text-[12px] font-mono truncate select-all"
        style={{ color: CYAN }}
        title={url}
      >
        {url}
      </span>

      <motion.button
        onClick={handleCopy}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        aria-label="Copy link"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
        style={{
          background: copied ? 'rgba(52,211,153,0.14)' : 'rgba(0,218,243,0.10)',
          border: copied
            ? '1px solid rgba(52,211,153,0.28)'
            : '1px solid rgba(0,218,243,0.22)',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Check className="w-3.5 h-3.5" style={{ color: '#34D399' }} />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Copy className="w-3.5 h-3.5" style={{ color: CYAN }} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ShareBoardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  boardTitle: string
  // The caller's resolved board role from BoardDetailResponse.my_board_role.
  // Passed directly — do NOT re-derive from members array.
  myBoardRole: BoardRole | string
}

export function ShareBoardDialog({
  open,
  onOpenChange,
  boardId,
  boardTitle,
  myBoardRole,
}: ShareBoardDialogProps) {
  // board owner + admin can manage the share link
  const canManage = myBoardRole === 'owner' || myBoardRole === 'admin'

  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const { mutate: generate, isPending: isGenerating } = useGenerateShareLink(boardId)
  const { mutate: revoke, isPending: isRevoking } = useRevokeShareLink(boardId)

  function handleGenerate() {
    generate(undefined, {
      onSuccess: (data) => setShareUrl(data.url),
    })
  }

  function handleRevoke() {
    revoke(undefined, {
      onSuccess: () => {
        setShareUrl(null)
        setConfirmRevoke(false)
      },
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) setConfirmRevoke(false)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden gap-0"
        style={DIALOG_CONTENT_STYLE}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(0,218,243,0.10)',
                border: '1px solid rgba(0,218,243,0.20)',
              }}
            >
              <Link2 className="w-4 h-4" style={{ color: CYAN }} />
            </div>

            <div>
              <DialogTitle
                className="text-[15px] font-bold tracking-tight leading-none"
                style={{ color: 'oklch(0.93 0.012 265)' }}
              >
                Share board
              </DialogTitle>
              <p
                className="text-[12px] mt-0.5 truncate max-w-[260px]"
                style={{ color: 'rgba(255,255,255,0.38)' }}
              >
                {boardTitle}
              </p>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Generate or revoke a public read-only share link for this board.
          </DialogDescription>
        </DialogHeader>

        <div
          className="h-px mx-6 mt-5"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.50)' }}
          >
            Anyone with the link can view this board in{' '}
            <span style={{ color: CYAN_DIM }}>read-only</span> mode — no
            account required. They cannot make any changes.
          </p>

          {/* Editor notice */}
          {!canManage && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
              style={{
                background: 'rgba(251,146,60,0.06)',
                border: '1px solid rgba(251,146,60,0.16)',
              }}
            >
              <ShieldAlert
                className="w-3.5 h-3.5 mt-0.5 shrink-0"
                style={{ color: '#FB923C' }}
              />
              <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Only board admins and owners can generate or revoke share links.
              </p>
            </motion.div>
          )}

          <AnimatePresence>
            {shareUrl && <CopyField url={shareUrl} />}
          </AnimatePresence>

          {/* Owner / admin actions */}
          {canManage && (
            <div className="space-y-2.5">
              <motion.button
                onClick={handleGenerate}
                disabled={isGenerating || isRevoking}
                whileHover={{ scale: isGenerating ? 1 : 1.01 }}
                whileTap={{ scale: isGenerating ? 1 : 0.98 }}
                transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                className={cn(
                  'w-full flex items-center justify-center gap-2',
                  'px-4 py-2.5 rounded-xl text-[13px] font-bold',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  'transition-opacity disabled:opacity-50',
                )}
                style={{
                  background:
                    'linear-gradient(135deg, oklch(0.82 0.14 198 / 0.18) 0%, oklch(0.42 0.09 198 / 0.12) 100%)',
                  border: '1px solid oklch(0.82 0.14 198 / 0.28)',
                  color: CYAN,
                }}
              >
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : shareUrl ? (
                  <RefreshCw className="w-3.5 h-3.5" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
                {shareUrl ? 'Regenerate link' : 'Generate link'}
              </motion.button>

              <AnimatePresence>
                {shareUrl && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    {!confirmRevoke ? (
                      <motion.button
                        onClick={() => setConfirmRevoke(true)}
                        disabled={isRevoking || isGenerating}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                        className={cn(
                          'w-full flex items-center justify-center gap-2',
                          'px-4 py-2.5 rounded-xl text-[13px] font-semibold',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40',
                          'transition-opacity disabled:opacity-50',
                        )}
                        style={{
                          background: 'rgba(239,68,68,0.06)',
                          border: '1px solid rgba(239,68,68,0.16)',
                          color: 'rgba(248,113,113,0.80)',
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Revoke link
                      </motion.button>
                    ) : (
                      <motion.div
                        key="confirm"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="rounded-xl px-4 py-3 space-y-3"
                        style={{
                          background: 'rgba(239,68,68,0.07)',
                          border: '1px solid rgba(239,68,68,0.20)',
                        }}
                      >
                        <p
                          className="text-[12px] text-center"
                          style={{ color: 'rgba(255,255,255,0.55)' }}
                        >
                          The current link will stop working immediately. Are you sure?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmRevoke(false)}
                            className="flex-1 py-2 rounded-lg text-[12px] font-semibold focus:outline-none"
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.09)',
                              color: 'rgba(255,255,255,0.45)',
                            }}
                          >
                            Cancel
                          </button>
                          <motion.button
                            onClick={handleRevoke}
                            disabled={isRevoking}
                            whileTap={{ scale: 0.97 }}
                            className="flex-1 py-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-opacity disabled:opacity-60 focus:outline-none"
                            style={{
                              background: 'rgba(239,68,68,0.18)',
                              border: '1px solid rgba(239,68,68,0.30)',
                              color: '#F87171',
                            }}
                          >
                            {isRevoking ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            Revoke
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <p
            className="text-[11px] text-center"
            style={{ color: 'rgba(255,255,255,0.22)' }}
          >
            Share links provide read-only access and do not require sign-in.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}