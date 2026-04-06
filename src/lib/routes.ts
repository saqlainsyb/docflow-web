// ── API Route Constants ────────────────────────────────────────────────────────
// Single source of truth for every backend endpoint.
//
// Rules:
// - All paths are relative to the Axios baseURL (/api/v1 in api.ts)
// - Dynamic segments use a function: ROUTES.boards.detail('id') → '/boards/id'
// - Never write a raw path string in a hook or component — always import from here
// - Group by domain to mirror the backend handler structure

export const ROUTES = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    register: "/auth/register",
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  users: {
    me: "/users/me",
  },

  // ── Workspaces ────────────────────────────────────────────────────────────
  workspaces: {
    list: "/workspaces",
    create: "/workspaces",
    detail: (id: string) => `/workspaces/${id}`,
    update: (id: string) => `/workspaces/${id}`,
    delete: (id: string) => `/workspaces/${id}`,
    members: (id: string) => `/workspaces/${id}/members`,
    member: (id: string, uid: string) => `/workspaces/${id}/members/${uid}`,
    boards: (id: string) => `/workspaces/${id}/boards`,
  },

  // ── Boards ────────────────────────────────────────────────────────────────
  boards: {
    create: (workspaceId: string) => `/workspaces/${workspaceId}/boards`,
    detail: (id: string) => `/boards/${id}`,
    update: (id: string) => `/boards/${id}`,
    delete: (id: string) => `/boards/${id}`,
    members: (id: string) => `/boards/${id}/members`,
    member: (id: string, uid: string) => `/boards/${id}/members/${uid}`,
    transfer: (id: string) => `/boards/${id}/transfer`,
    shareLink: (id: string) => `/boards/${id}/share-link`,
    archivedCards: (id: string) => `/boards/${id}/archived-cards`,
  },

  // ── Public ────────────────────────────────────────────────────────────────
  share: {
    view: (token: string) => `/share/${token}`,
  },

  // ── Columns ───────────────────────────────────────────────────────────────
  columns: {
    create: (boardId: string) => `/boards/${boardId}/columns`,
    update: (id: string) => `/columns/${id}`,
    delete: (id: string) => `/columns/${id}`,
  },

  // ── Cards ─────────────────────────────────────────────────────────────────
  cards: {
    create: (columnId: string) => `/columns/${columnId}/cards`,
    update: (id: string) => `/cards/${id}`,
    delete: (id: string) => `/cards/${id}`,
    move: (id: string) => `/cards/${id}/move`,
    archive: (id: string) => `/cards/${id}/archive`,
    unarchive: (id: string) => `/cards/${id}/unarchive`,
  },

  // ── Documents ─────────────────────────────────────────────────────────────
  documents: {
    token: (id: string) => `/documents/${id}/token`,
    snapshot: (id: string) => `/documents/${id}/snapshot`,
  },
} as const;
