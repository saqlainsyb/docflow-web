import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { store } from "@/store";
import { setAccessToken, clearCredentials } from "@/store";

// ── Axios instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api/v1",
  withCredentials: true, // sends the HttpOnly refresh_token cookie on every request
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Attaches the access token from Redux to every outgoing request.
// Runs before every request — reads the latest token at call time,
// not at the time the interceptor was registered.

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = store.getState().auth.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Refresh lock ──────────────────────────────────────────────────────────────
// Prevents multiple simultaneous 401s from each triggering their own refresh.
// Without this, if 3 requests fail at once with TOKEN_EXPIRED, you'd fire
// 3 refresh calls, the first succeeds, the second and third use an already-
// rotated (revoked) token and trigger TOKEN_THEFT_DETECTED — logging the user out.
//
// Instead: the first 401 starts the refresh and stores the promise.
// Subsequent 401s wait on that same promise and retry with the new token.

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = (): Promise<string> => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = api
    .post<{ access_token: string; user: object }>('/auth/refresh', {})
    .then((res) => {
      const newToken = res.data.access_token
      store.dispatch(setAccessToken(newToken))
      return newToken
    })
    .finally(() => {
      isRefreshing = false
      refreshPromise = null
    })

  return refreshPromise;
};

// ── Response interceptor ──────────────────────────────────────────────────────
// Handles token expiry transparently — the component that made the request
// never knows a refresh happened. It just gets back the data it asked for.

api.interceptors.response.use(
  // success path — pass through untouched
  (response) => response,

  // error path
  async (error: AxiosError<{ error?: { code?: string } }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retried?: boolean;
    };

    const code = error.response?.data?.error?.code;
    const status = error.response?.status;

    // ── Token expired — attempt silent refresh ────────────────────────────
    // Only retry once (_retried flag) to prevent infinite loops if the
    // refresh itself keeps returning TOKEN_EXPIRED.
    if (
      status === 401 &&
      (code === "TOKEN_EXPIRED" || code === "MISSING_TOKEN") &&
      !originalRequest._retried
    ) {
      originalRequest._retried = true;

      try {
        const newToken = await refreshAccessToken();
        // update the Authorization header on the stalled request
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        // retry the original request with the new token
        return api(originalRequest);
      } catch {
        // refresh failed — clear everything and let the app redirect to login
        store.dispatch(clearCredentials());
        return Promise.reject(error);
      }
    }

    // ── Token theft detected — force logout ───────────────────────────────
    // Backend killed all sessions. Clear client state immediately.
    if (status === 401 && code === "TOKEN_THEFT_DETECTED") {
      store.dispatch(clearCredentials());
      return Promise.reject(error);
    }

    // ── All other errors — pass through to the caller ─────────────────────
    return Promise.reject(error);
  },
);

export default api;
