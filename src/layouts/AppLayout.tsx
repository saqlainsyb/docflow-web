import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { Layers } from 'lucide-react'

/**
 * AppLayout — Responsive
 *
 * Desktop (≥ lg / 1024px): fixed sidebar 240px, main offset ml-60
 * Mobile  (< lg):           sidebar hidden behind a hamburger button;
 *                            tapping it slides in a sheet with backdrop
 */
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Close sidebar on route change on mobile
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Close on ESC key
  useEffect(() => {
    if (!sidebarOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sidebarOpen])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="min-h-dvh bg-background text-foreground">

      {/* ── Desktop sidebar — always visible lg+ ─────────────────────────── */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* ── Mobile sidebar — animated sheet ──────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <main className="lg:ml-60 min-h-dvh">

        {/* Mobile topbar — only visible < lg, sits above each page's own topbar */}
        <div
          className="lg:hidden flex items-center gap-3 h-14 px-4 sticky top-0 z-30"
          style={{
            background: 'oklch(0.12 0.015 265 / 92%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid oklch(0.35 0.015 265 / 10%)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            className="flex items-center justify-center w-9 h-9 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo lockup */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[6px] df-gradient-logo flex items-center justify-center shrink-0">
              <Layers className="w-3 h-3 text-primary-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-[16px] tracking-[-0.01em] text-on-surface">
              Docflow
            </span>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  )
}