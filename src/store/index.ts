import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '@/lib/types'

// ── Auth Slice ────────────────────────────────────────────────────────────────
// Owns: access token (memory only, 15min TTL) + authenticated user.
// Refresh token lives in an HttpOnly cookie — never touches JS or Redux.
// isAuthenticated is intentionally absent — derive it with: user !== null

interface AuthState {
  user: User | null
  accessToken: string | null
}

const authInitialState: AuthState = {
  user: null,
  accessToken: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState: authInitialState,
  reducers: {
    // called after successful login or register
    // backend response body contains: { user, access_token }
    // refresh token arrives separately as an HttpOnly cookie — not here
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; access_token: string }>,
    ) => {
      state.user = action.payload.user
      state.accessToken = action.payload.access_token
    },

    // called by the Axios interceptor after a silent refresh succeeds
    // backend sends a new access_token in the response body
    // backend also overwrites the HttpOnly cookie with a new refresh token
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload
    },

    // called after logout or TOKEN_THEFT_DETECTED
    // clears memory state — the HttpOnly cookie is cleared by the backend
    clearCredentials: (state) => {
      state.user = null
      state.accessToken = null
    },

    // called after PATCH /users/me succeeds
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload }
      }
    },
  },
})

// ── UI Slice ──────────────────────────────────────────────────────────────────
// Owns: sidebar state, active modal, theme.
// Nothing server-related lives here — that's TanStack Query's job.

type Modal =
  | { type: 'createWorkspace' }
  | { type: 'createBoard'; workspaceId: string }
  | { type: 'createColumn'; boardId: string }
  | { type: 'createCard'; columnId: string }
  | { type: 'editCard'; cardId: string }
  | null

interface UIState {
  sidebarOpen: boolean
  activeModal: Modal
  theme: 'light' | 'dark' | 'system'
}

const uiInitialState: UIState = {
  sidebarOpen: true,
  activeModal: null,
  theme: 'system',
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: uiInitialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    openModal: (state, action: PayloadAction<Modal>) => {
      state.activeModal = action.payload
    },
    closeModal: (state) => {
      state.activeModal = null
    },
    setTheme: (state, action: PayloadAction<UIState['theme']>) => {
      state.theme = action.payload
    },
  },
})

// ── WS Slice ──────────────────────────────────────────────────────────────────
// Owns: connection status per board and document room.
// Components use this to render "reconnecting..." indicators.
// Actual WebSocket instances are NOT stored here — they are not serialisable.
// They live in useRef inside the hooks that manage them.

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting'

interface WSState {
  boards: Record<string, ConnectionStatus>
  documents: Record<string, ConnectionStatus>
}

const wsInitialState: WSState = {
  boards: {},
  documents: {},
}

const wsSlice = createSlice({
  name: 'ws',
  initialState: wsInitialState,
  reducers: {
    setBoardStatus: (
      state,
      action: PayloadAction<{ boardId: string; status: ConnectionStatus }>,
    ) => {
      state.boards[action.payload.boardId] = action.payload.status
    },
    setDocumentStatus: (
      state,
      action: PayloadAction<{ documentId: string; status: ConnectionStatus }>,
    ) => {
      state.documents[action.payload.documentId] = action.payload.status
    },
    clearBoardStatus: (state, action: PayloadAction<string>) => {
      delete state.boards[action.payload]
    },
    clearDocumentStatus: (state, action: PayloadAction<string>) => {
      delete state.documents[action.payload]
    },
  },
})

// ── Store ─────────────────────────────────────────────────────────────────────

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    ui: uiSlice.reducer,
    ws: wsSlice.reducer,
  },
})

// ── Exports ───────────────────────────────────────────────────────────────────

export const { setCredentials, setAccessToken, clearCredentials, updateUser } =
  authSlice.actions

export const { toggleSidebar, setSidebarOpen, openModal, closeModal, setTheme } =
  uiSlice.actions

export const { setBoardStatus, setDocumentStatus, clearBoardStatus, clearDocumentStatus } =
  wsSlice.actions

// Inferred types — never hardcode these
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch