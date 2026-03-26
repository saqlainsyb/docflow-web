// src/components/modals/ModalManager.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Global modal renderer. Reads activeModal from the Redux UI slice and
// renders exactly one modal at a time.
//
// Lives in AppLayout — always mounted when the user is authenticated.
// Never needs to be rendered anywhere else.
//
// Adding a new modal (Modules 5–8):
//   1. Create src/components/modals/YourModal.tsx
//   2. Add a case to the switch below
//   3. Done — nothing else changes
//
// Why Redux for modal state (not local state / context):
//   Any component in the tree can trigger any modal by dispatching openModal().
//   The sidebar, a page header, a card — all can open the same modal without
//   prop drilling or shared context setup. The modal manager is the single
//   consumer; everyone else is just a producer.
// ─────────────────────────────────────────────────────────────────────────────

import { useAppSelector } from '@/store/hooks'
import { CreateWorkspaceModal } from '@/components/modals/CreateWorkspaceModal'

export function ModalManager() {
  const activeModal = useAppSelector((state) => state.ui.activeModal)

  // Early return when no modal is active — nothing to render
  if (!activeModal) return null

  switch (activeModal.type) {
    case 'createWorkspace':
      return <CreateWorkspaceModal open />

    // ── Module 5 ──────────────────────────────────────────────────────────
    // case 'createBoard':
    //   return <CreateBoardModal open workspaceId={activeModal.workspaceId} />

    // ── Module 5 (board view) ─────────────────────────────────────────────
    // case 'createColumn':
    //   return <CreateColumnModal open boardId={activeModal.boardId} />

    // case 'createCard':
    //   return <CreateCardModal open columnId={activeModal.columnId} />

    // case 'editCard':
    //   return <EditCardModal open cardId={activeModal.cardId} />

    default:
      // Exhaustive check — TypeScript will error here if a new Modal
      // union member is added to the store without a matching case
      return null
  }
}