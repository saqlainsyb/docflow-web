// src/pages/invitations/InvitationAcceptPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Public invitation accept page — matches the Docflow auth page aesthetic.
//
// Design system alignment:
//   • Same BackgroundOrbs + AuthCard glass panel as LoginPage/RegisterPage
//   • OKLCH color tokens, df-gradient-cta, primary glow
//   • Manrope display headings, Inter body
//   • Framer Motion spring entrances, stagger reveals, AnimatePresence
//   • AuthFooter at bottom (identical to auth pages)
//
// Two flows:
//   A. Logged in  → show workspace card + "Accept & Join" CTA
//   B. Guest      → "Create account" (primary) + "Sign in" (secondary)
//
// Both flows redirect through /register?invitation=:token or
// /login?invitation=:token where useRegister/useLogin auto-accept on success.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import {
  CheckCircle, XCircle, Loader2,
  Crown, ShieldCheck, User, Clock, Mail, ArrowRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppSelector } from '@/store/hooks'
import { useGetInvitation } from '@/hooks/useGetInvitation'
import { useAcceptInvitation } from '@/hooks/useAcceptInvitation'
import type { ApiErrorCode, WorkspaceRole } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Error code → human message ─────────────────────────────────────────────────

function getErrorContent(error: unknown): { heading: string; body: string } {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) {
    return { heading: 'Something went wrong', body: 'Please try again or contact the workspace admin.' }
  }
  const code = error.response?.data?.error?.code
  switch (code) {
    case 'INVITATION_INVALID':
      return { heading: 'Invalid invitation', body: 'This link is invalid or has already been used. Ask the workspace admin to send a new invitation.' }
    case 'INVITATION_EXPIRED':
      return { heading: 'Invitation expired', body: 'This invitation link has expired. Ask the workspace admin to send a fresh one.' }
    case 'INVITATION_EMAIL_MISMATCH':
      return { heading: 'Wrong account', body: 'This invitation was sent to a different email address. Sign in with the correct account and try again.' }
    case 'ALREADY_WORKSPACE_MEMBER':
      return { heading: 'Already a member', body: "You're already a member of this workspace — nothing left to do." }
    default:
      return { heading: 'Something went wrong', body: 'Please try again or contact the workspace admin.' }
  }
}

// ── Role display config — matches ROLE_CONFIG in MembersPage ─────────────────

const ROLE_DISPLAY: Record<WorkspaceRole, {
  label: string; icon: React.ElementType; pillClass: string
}> = {
  owner:  { label: 'Owner',  icon: Crown,       pillClass: 'bg-primary/10 text-primary border border-primary/20' },
  admin:  { label: 'Admin',  icon: ShieldCheck, pillClass: 'bg-df-secondary/10 text-df-secondary border border-df-secondary/20' },
  member: { label: 'Member', icon: User,        pillClass: 'bg-surface-container-highest text-on-surface-variant border border-outline-variant/20' },
}

function RolePill({ role }: { role: WorkspaceRole }) {
  const { label, icon: Icon, pillClass } = ROLE_DISPLAY[role] ?? ROLE_DISPLAY.member
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold', pillClass)}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </span>
  )
}

// ── Motion variants ────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
} as const

// ── Background orbs — identical to BackgroundOrbs.tsx ─────────────────────────

function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* Primary orb — top-left, same as auth pages */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px]"
      />
      {/* Secondary orb — bottom-right */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        className="absolute bottom-[-5%] right-[-5%] w-[35%] h-[35%] rounded-full bg-secondary/10 blur-[100px]"
      />
    </div>
  )
}

// ── Glass card — identical to AuthCard ────────────────────────────────────────

function InviteCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={cn(
        'w-full max-w-[440px]',
        'bg-(--df-surface-low)/60 backdrop-blur-xl',
        'rounded-xl border border-white/5',
        'shadow-[0_0_50px_rgba(0,0,0,0.3)]',
        'overflow-hidden',
      )}
    >
      {children}
    </motion.div>
  )
}

// ── Workspace identity header inside the card ─────────────────────────────────

function WorkspaceHeader({ workspaceName, inviterName, invitedEmail, role, daysLeft }: {
  workspaceName: string; inviterName: string; invitedEmail: string
  role: WorkspaceRole; daysLeft: number
}) {
  const isUrgent = daysLeft <= 1

  return (
    <>
      {/* Card header block */}
      <motion.div
        variants={itemVariants}
        className="px-8 pt-8 pb-6"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Eyebrow */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary mb-3">
          Workspace Invitation
        </p>

        {/* Workspace name — large display heading */}
        <h1
          className="text-3xl font-extrabold tracking-tight text-on-surface leading-tight mb-2"
          style={{ fontFamily: 'var(--df-font-display)' }}
        >
          {workspaceName}
        </h1>

        {/* Inviter blurb */}
        <p className="text-sm text-outline leading-relaxed">
          <span
            className="font-semibold"
            style={{ color: 'oklch(0.91 0.015 265)' }}
          >
            {inviterName}
          </span>{' '}
          has invited you to collaborate as
        </p>

        <div className="mt-3">
          <RolePill role={role} />
        </div>
      </motion.div>

      {/* Invited-to chip */}
      <motion.div
        variants={itemVariants}
        className="px-8 py-3 flex items-center gap-2 text-xs text-outline"
        style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Mail className="size-3.5 shrink-0 text-outline/60" />
        <span>
          Sent to <span className="font-medium text-on-surface-variant">{invitedEmail}</span>
        </span>
        <span className="text-outline/30">·</span>
        <span className={cn('inline-flex items-center gap-1', isUrgent && 'text-destructive')}>
          <Clock className="size-3" />
          {daysLeft > 0 ? `${daysLeft}d left` : 'Expires today'}
        </span>
      </motion.div>
    </>
  )
}

// ── InvitationAcceptPage ───────────────────────────────────────────────────────

export function InvitationAcceptPage() {
  const { token = '' } = useParams<{ token: string }>()
  const navigate       = useNavigate()
  const user           = useAppSelector((state) => state.auth.user)

  const { data: invitation, isLoading: inviteLoading, error: inviteError } = useGetInvitation(token)
  const { mutate: accept, isPending: accepting, error: acceptError, isSuccess: accepted, data: acceptData } = useAcceptInvitation()

  // Navigate to workspace after successful accept
  useEffect(() => {
    if (accepted && acceptData?.workspace_id) {
      navigate(`/${acceptData.workspace_id}/boards`, { replace: true })
    }
  }, [accepted, acceptData, navigate])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (inviteLoading) {
    return (
      <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <BackgroundOrbs />
        <main className="grow flex items-center justify-center p-6 z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-outline">Loading invitation…</p>
          </motion.div>
        </main>
      </div>
    )
  }

  // ── Invalid / expired invitation ───────────────────────────────────────────
  if (inviteError) {
    const { heading, body } = getErrorContent(inviteError)
    return (
      <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <BackgroundOrbs />
        <main className="grow flex items-center justify-center p-6 z-10">
          <InviteCard>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col items-center gap-4 py-12 px-8 text-center"
            >
              <motion.div variants={itemVariants}>
                <XCircle className="size-12 text-destructive" strokeWidth={1.5} />
              </motion.div>
              <motion.div variants={itemVariants} className="space-y-1.5">
                <h2 className="font-display text-lg font-bold text-on-surface">{heading}</h2>
                <p className="text-sm text-outline leading-relaxed">{body}</p>
              </motion.div>
            </motion.div>
          </InviteCard>
        </main>
      </div>
    )
  }

  if (!invitation) return null

  const expiresAt = new Date(invitation.expires_at)
  const daysLeft  = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))

  // ── Accept error ───────────────────────────────────────────────────────────
  if (acceptError) {
    const { heading, body } = getErrorContent(acceptError)
    return (
      <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <BackgroundOrbs />
        <main className="grow flex items-center justify-center p-6 z-10">
          <InviteCard>
            <WorkspaceHeader
              workspaceName={invitation.workspace_name}
              inviterName={invitation.inviter_name}
              invitedEmail={invitation.invited_email}
              role={invitation.role}
              daysLeft={daysLeft}
            />
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col items-center gap-4 py-8 px-8 text-center"
            >
              <motion.div variants={itemVariants}>
                <XCircle className="size-10 text-destructive" strokeWidth={1.5} />
              </motion.div>
              <motion.div variants={itemVariants} className="space-y-1.5">
                <h3 className="font-display font-bold text-base text-on-surface">{heading}</h3>
                <p className="text-sm text-outline leading-relaxed">{body}</p>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Link
                  to={`/login?invitation=${token}`}
                  className="text-sm text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
                >
                  Sign in with a different account
                </Link>
              </motion.div>
            </motion.div>
          </InviteCard>
        </main>
      </div>
    )
  }

  // ── FLOW A — Logged in ─────────────────────────────────────────────────────
  if (user) {
    return (
      <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <BackgroundOrbs />

        {/* Brand mark — matches auth pages */}
        <div className="relative z-10 px-8 pt-8">
          <span className="text-lg font-black text-foreground">Docflow</span>
        </div>

        <main className="grow flex items-center justify-center p-6 z-10">
          <InviteCard>
            <WorkspaceHeader
              workspaceName={invitation.workspace_name}
              inviterName={invitation.inviter_name}
              invitedEmail={invitation.invited_email}
              role={invitation.role}
              daysLeft={daysLeft}
            />

            {/* CTA section */}
            <div className="px-8 py-7 space-y-4">
              {/* Signed-in-as chip */}
              <motion.div
                variants={itemVariants}
                className="flex items-center justify-center gap-2 text-[11px] text-outline"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ background: 'oklch(0.38 0.12 198)', color: 'oklch(0.92 0.015 265)' }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span>
                  Signed in as{' '}
                  <span className="font-medium text-on-surface-variant">{user.email}</span>
                </span>
              </motion.div>

              {/* Accept CTA */}
              <motion.div variants={itemVariants}>
                <motion.button
                  onClick={() => accept(token)}
                  disabled={accepting}
                  whileHover={!accepting ? { scale: 1.02, boxShadow: '0 4px 28px oklch(0.82 0.14 198 / 28%)' } : {}}
                  whileTap={!accepting ? { scale: 0.98 } : {}}
                  className={cn(
                    'w-full df-gradient-cta h-11 rounded-xl',
                    'text-sm font-bold text-primary-foreground',
                    'flex items-center justify-center gap-2',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    'disabled:opacity-60 disabled:pointer-events-none',
                  )}
                >
                  {accepting ? (
                    <><Loader2 className="size-4 animate-spin" />Joining…</>
                  ) : (
                    <><CheckCircle className="size-4" />Accept &amp; Join Workspace</>
                  )}
                </motion.button>
              </motion.div>

              {/* Switch account link */}
              <motion.p
                variants={itemVariants}
                className="text-center text-xs text-outline"
              >
                Not you?{' '}
                <Link
                  to={`/login?invitation=${token}`}
                  className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
                >
                  Sign in with a different account
                </Link>
              </motion.p>
            </div>
          </InviteCard>
        </main>
      </div>
    )
  }

  // ── FLOW B — Guest ─────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <BackgroundOrbs />

      {/* Brand mark */}
      <div className="relative z-10 px-8 pt-8">
        <span className="text-lg font-black text-foreground">Docflow</span>
      </div>

      <main className="grow flex items-center justify-center p-6 z-10">
        <InviteCard>
          <WorkspaceHeader
            workspaceName={invitation.workspace_name}
            inviterName={invitation.inviter_name}
            invitedEmail={invitation.invited_email}
            role={invitation.role}
            daysLeft={daysLeft}
          />

          {/* CTA section */}
          <div className="px-8 py-7 space-y-3">
            <motion.p
              variants={itemVariants}
              className="text-center text-sm text-outline mb-5"
            >
              Create a free account or sign in to accept this invitation.
            </motion.p>

            {/* Primary CTA — create account */}
            <motion.div variants={itemVariants}>
              <motion.div
                whileHover={{ scale: 1.02, boxShadow: '0 4px 28px oklch(0.82 0.14 198 / 28%)' }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={`/register?invitation=${token}`}
                  className={cn(
                    'w-full df-gradient-cta h-11 rounded-xl',
                    'text-sm font-bold text-primary-foreground',
                    'flex items-center justify-center gap-2',
                  )}
                >
                  <ArrowRight className="size-4" />
                  Create account &amp; join
                </Link>
              </motion.div>
            </motion.div>

            {/* Divider */}
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-3"
            >
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[11px] text-outline/50">or</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </motion.div>

            {/* Secondary CTA — sign in */}
            <motion.div variants={itemVariants}>
              <motion.div
                whileHover={{ borderColor: 'rgba(255,255,255,0.14)' }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  to={`/login?invitation=${token}`}
                  className={cn(
                    'w-full h-10 rounded-xl',
                    'text-sm font-semibold text-on-surface-variant',
                    'flex items-center justify-center gap-2',
                    'border border-white/[0.08] hover:border-white/[0.14]',
                    'bg-white/[0.03] hover:bg-white/[0.06]',
                    'transition-all duration-150',
                  )}
                >
                  Sign in instead
                </Link>
              </motion.div>
            </motion.div>

            {/* Reassurance footnote */}
            <motion.p
              variants={itemVariants}
              className="text-center text-[11px] text-outline/50 pt-1"
            >
              Free forever · No credit card required
            </motion.p>
          </div>
        </InviteCard>
      </main>

      {/* Footer — matches AuthFooter */}
      <footer className="w-full py-5 border-t border-white/5 bg-background z-10">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 gap-4 max-w-7xl mx-auto w-full">
          <span className="text-lg font-black text-foreground">Docflow</span>
          <p className="text-on-surface-variant text-[10px] tracking-[0.2em] uppercase">
            © 2025 Docflow. The Kinetic Ether.
          </p>
        </div>
      </footer>
    </div>
  )
}