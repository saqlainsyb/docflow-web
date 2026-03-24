import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useAppDispatch } from '@/store/hooks'
import { setCredentials, clearCredentials } from '@/store'
import type { User } from '@/store'

// ── useAuthBootstrap ──────────────────────────────────────────────────────────
// Called once in App.tsx before any route renders.
//
// Problem it solves:
// Redux state is in memory — it resets to null on every page refresh.
// Without this hook, a logged-in user who refreshes the tab sees a blank
// screen or gets redirected to /login even though their session is valid.
//
// How it works:
// 1. Call GET /users/me with the access token from Redux (null on fresh load)
// 2. If it succeeds → user is logged in, dispatch setCredentials
// 3. If it returns TOKEN_EXPIRED → the Axios interceptor in api.ts
//    automatically calls /auth/refresh using the HttpOnly cookie,
//    gets a new access token, retries /me, and if that succeeds
//    the interceptor has already dispatched setAccessToken —
//    so /me succeeds and we dispatch setCredentials with the user data
// 4. If refresh also fails (cookie expired/missing) → dispatch clearCredentials
//    and the app routes the user to /login normally
//
// isBootstrapping: true until we know the auth state one way or the other.
// The app renders nothing (or a spinner) while this is true to prevent
// a flash of the login page for authenticated users.

interface UseAuthBootstrapResult {
  isBootstrapping: boolean
}

export function useAuthBootstrap(): UseAuthBootstrapResult {
  const dispatch = useAppDispatch()
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        // GET /users/me — if the access token is valid this returns immediately.
        // If TOKEN_EXPIRED, api.ts intercepts the 401, silently calls /auth/refresh,
        // gets a new access token, retries this request — all transparently.
        const { data } = await api.get<User>('/users/me')

        if (!cancelled) {
          // /me succeeded (either directly or after a silent refresh)
          // we need the access token that is now in Redux (may have been
          // updated by the interceptor) to store alongside the user
          dispatch(
            setCredentials({
              user: data,
              // the interceptor already called setAccessToken if a refresh happened
              // read the current value from the store rather than assuming null
              access_token:
                (api.defaults.headers.common['Authorization'] as string)?.replace(
                  'Bearer ',
                  '',
                ) ?? '',
            }),
          )
        }
      } catch {
        // /me failed and refresh also failed — no valid session
        if (!cancelled) {
          dispatch(clearCredentials())
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false)
        }
      }
    }

    bootstrap()

    // cleanup: if the component unmounts mid-request (rare but possible in
    // StrictMode double-invoke), don't dispatch stale state updates
    return () => {
      cancelled = true
    }
  }, [dispatch])

  return { isBootstrapping }
}