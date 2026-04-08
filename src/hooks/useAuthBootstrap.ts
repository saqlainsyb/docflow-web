import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useAppDispatch } from '@/store/hooks'
import { setCredentials, clearCredentials } from '@/store'
import type { User } from '@/lib/types'

// ── useAuthBootstrap ──────────────────────────────────────────────────────────
// Called once in App.tsx before any route renders.
//
// Problem it solves:
// Redux state is in memory — it resets to null on every page refresh.
// Without this hook, a logged-in user who refreshes the tab sees a blank
// screen or gets redirected to /login even though their session is valid.
//
// How it works:
// 1. Call GET /users/me — no access token in memory on fresh load, so this
//    always returns 401/TOKEN_EXPIRED on a page refresh.
// 2. The Axios interceptor in api.ts catches the 401, calls /auth/refresh
//    using the HttpOnly cookie, gets a new access token, retries /me.
// 3. If /me succeeds → dispatch setCredentials with the user + new token.
// 4. If refresh fails (cookie expired/missing) → dispatch clearCredentials
//    and the router redirects to /login.
//
// Why the module-level promise:
// React StrictMode intentionally mounts → unmounts → remounts every component
// in development. This causes useEffect to fire twice, which would launch two
// concurrent /users/me calls. Both would get 401, both would try to refresh —
// the second refresh uses an already-rotated token and triggers
// TOKEN_THEFT_DETECTED, logging the user out.
//
// The module-level `bootstrapPromise` ensures only one network call is ever
// in flight, regardless of how many times the hook mounts. Both invocations
// attach to the same promise and get the same result.

interface UseAuthBootstrapResult {
  isBootstrapping: boolean
}

// Module-level — lives for the lifetime of the JS bundle, not the component.
// Shared across StrictMode double-invocations and any other re-mounts.
let bootstrapPromise: Promise<User | null> | null = null

export function useAuthBootstrap(): UseAuthBootstrapResult {
  const dispatch = useAppDispatch()
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  useEffect(() => {
    // If a bootstrap is already in flight, attach to it instead of
    // starting a new one. This is the StrictMode double-invoke guard.
    if (!bootstrapPromise) {
      bootstrapPromise = api
        .get<User>('/users/me')
        .then((res) => res.data)
        .catch(() => null) // any failure = no valid session
        .finally(() => {
          // Clear so a future manual re-bootstrap (e.g. after logout+login)
          // starts fresh rather than re-using a resolved promise.
          bootstrapPromise = null
        })
    }

    bootstrapPromise.then((user) => {
      if (user) {
        dispatch(
          setCredentials({
            user,
            // The interceptor called setAccessToken after the silent refresh —
            // read it back from the Authorization header it set on the instance.
            access_token:
              (api.defaults.headers.common['Authorization'] as string)?.replace(
                'Bearer ',
                '',
              ) ?? '',
          }),
        )
      } else {
        dispatch(clearCredentials())
      }
      setIsBootstrapping(false)
    })
  }, [dispatch])

  return { isBootstrapping }
}