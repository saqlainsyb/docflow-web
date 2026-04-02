// src/components/toast/index.ts
// Re-export Sonner's toast directly — no wrapper needed.
// Use `toast` anywhere in the app, including mutation hooks.

export { toast } from 'sonner'
export { AppToaster } from './AppToaster'