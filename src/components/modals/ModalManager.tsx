// src/components/modals/ModalManager.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reads activeModal from Redux and renders the correct modal component.
// Lives in AppLayout so it's always mounted while the user is authenticated.
//
// Adding a new modal:
//   1. Add the type to the Modal union in store/index.ts
//   2. Import the component here
//   3. Add a case to the switch below
// ─────────────────────────────────────────────────────────────────────────────

import { useAppSelector } from '@/store/hooks'
import { CreateWorkspaceModal } from '@/components/modals/CreateWorkspaceModal'
import { CreateBoardModal } from '@/components/modals/CreateBoardModal'
import { CreateColumnModal } from '@/components/modals/CreateColumnModal'
import { CreateCardModal } from '@/components/modals/CreateCardModal'

export function ModalManager() {
  const activeModal = useAppSelector((state) => state.ui.activeModal)

  if (!activeModal) return null

  switch (activeModal.type) {
    case 'createWorkspace':
      return <CreateWorkspaceModal />

    case 'createBoard':
      return <CreateBoardModal workspaceId={activeModal.workspaceId} />

    case 'createColumn':
      return <CreateColumnModal boardId={activeModal.boardId} />

    case 'createCard':
      return <CreateCardModal columnId={activeModal.columnId} />

    case 'editCard':
      // Module 6 — TipTap document editor
      return null

    default:
      return null
  }
}