import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import api from '@/lib/api'
import { useAppDispatch } from '@/store/hooks'
import { clearCredentials } from '@/store'

// ── useLogout ─────────────────────────────────────────────────────────────────
// Returns a logout() function. Call it from any component — nav, user menu,
// settings page etc.
//
// Order is intentional:
// 1. POST /auth/logout  → backend revokes the refresh token in the DB
//                         and clears the HttpOnly cookie via Set-Cookie header
// 2. clearCredentials   → wipes access token and user from Redux
// 3. toast.success      → shown before navigate so it persists on /login
// 4. navigate('/login') → redirects the user
//
// Why server before client:
// If we cleared Redux first and the POST failed (network hiccup), the user
// would appear logged out in the UI but the HttpOnly cookie would still be
// alive. They'd get silently re-authenticated on the next tab open.
// By going server-first, we guarantee the session is dead before the UI changes.
//
// Why we clear Redux even if the POST fails:
// If the backend is unreachable we still want the user gone from the UI.
// The refresh cookie may survive, but the 15min access token will expire
// naturally and the next silent refresh attempt will fail since the server
// is down. In practice this is the safest UX tradeoff.

export function useLogout() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const logout = useCallback(async () => {
    try {
      // tell the backend to revoke the token and clear the cookie
      await api.post('/auth/logout')
    } catch {
      // network error or already logged out on the server side —
      // proceed with client-side cleanup regardless
    } finally {
      // always clear client state — no matter what the server said
      dispatch(clearCredentials())
      // toast before navigate so Sonner (mounted at app root) carries it to /login
      toast.success('Signed out')
      navigate('/login', { replace: true })
    }
  }, [dispatch, navigate])

  return logout
}