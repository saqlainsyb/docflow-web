import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { store } from '@/store'
import { setAccessToken, clearCredentials } from '@/store'

// ── Axios instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Request interceptor ───────────────────────────────────────────────────────
// Attaches the access token from Redux to every outgoing request.

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Refresh lock ──────────────────────────────────────────────────────────────
// Prevents multiple simultaneous 401s from each triggering their own refresh.
// Without this, if 3 requests fail at once with TOKEN_EXPIRED, you'd fire
// 3 refresh calls — the first succeeds, the second and third use an already-
// rotated (revoked) token and trigger TOKEN_THEFT_DETECTED — logging the user out.
//
// Instead: the first 401 starts the refresh and stores the promise.
// Subsequent 401s wait on that same promise and retry with the new token.

let isRefreshing = false
let refreshPromise: Promise<string> | null = null

// Extend Axios config type to carry our custom flags through the interceptor.
interface RequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
  _isRefreshCall?: boolean
}

const refreshAccessToken = (): Promise<string> => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise
  }

  isRefreshing = true

  // Use a plain axios instance — NOT the `api` instance — so this request
  // bypasses the response interceptor entirely and can never re-trigger
  // another refresh or a TOKEN_THEFT_DETECTED logout on failure.
  const baseURL = import.meta.env.VITE_API_URL ?? '/api/v1'

  refreshPromise = axios
    .post<{ access_token: string }>(
      `${baseURL}/auth/refresh`,
      {},
      { withCredentials: true },
    )
    .then((res) => {
      const newToken = res.data.access_token
      store.dispatch(setAccessToken(newToken))
      return newToken
    })
    .finally(() => {
      isRefreshing = false
      refreshPromise = null
    })

  return refreshPromise
}

// ── Response interceptor ──────────────────────────────────────────────────────
// Handles token expiry transparently — the component that made the request
// never knows a refresh happened. It just gets back the data it asked for.

api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError<{ error?: { code?: string } }>) => {
    const originalRequest = error.config as RequestConfig

    const code = error.response?.data?.error?.code
    const status = error.response?.status

    // ── Token expired — attempt silent refresh ────────────────────────────
    // _retried prevents an infinite loop if /auth/refresh itself returns 401.
    if (
      status === 401 &&
      (code === 'TOKEN_EXPIRED' || code === 'MISSING_TOKEN') &&
      !originalRequest._retried
    ) {
      originalRequest._retried = true

      try {
        const newToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch {
        // Refresh failed — cookie expired or missing. Send to login.
        store.dispatch(clearCredentials())
        return Promise.reject(error)
      }
    }

    // ── Token theft detected — force logout ───────────────────────────────
    if (status === 401 && code === 'TOKEN_THEFT_DETECTED') {
      store.dispatch(clearCredentials())
      return Promise.reject(error)
    }

    return Promise.reject(error)
  },
)

export default api