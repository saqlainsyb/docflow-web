// src/pages/workspace/SettingsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Workspace settings page — Redesigned (Obsidian Studio)
//
// Sections:
//   1. General    — Rename workspace (admin + owner)
//   2. Danger     — Delete workspace (owner only), typed confirmation dialog
//
// Design changes vs. original:
//   - Section-card layout: each section lives in its own rounded surface card
//     with a clear header, description, and a hairline divider before the action
//   - Topbar chip matches Members/Boards pattern (filled pill, not plain text)
//   - Rename input row is self-contained within its card — no loose form floats
//   - Saved state shows an inline success chip next to the button, not just
//     a button color change
//   - Danger zone: border-dashed replaced with a solid left-edge accent bar
//     on a slightly tinted surface — less shouty, still unmistakably serious
//   - Delete dialog: confirmation input has a destructive focus ring
//   - All logic, hooks, and validation are identical to the original
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import {
  Loader2,
  AlertTriangle,
  AlertCircle,
  Check,
  Settings,
  PenLine,
  Trash2,
} from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRenameWorkspace } from "@/hooks/useRenameWorkspace";
import { useDeleteWorkspace } from "@/hooks/useDeleteWorkspace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  renameWorkspaceSchema,
  type RenameWorkspaceFormValues,
} from "@/lib/validations";
import type { ApiErrorCode } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Error mapping ─────────────────────────────────────────────────────────────

const RENAME_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR: "Name is invalid. Check length and characters.",
  INSUFFICIENT_PERMISSIONS:
    "You don't have permission to rename this workspace.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

const DELETE_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  INSUFFICIENT_PERMISSIONS: "Only the workspace owner can delete it.",
  WORKSPACE_NOT_FOUND: "This workspace no longer exists.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

const FALLBACK_ERROR = "Something went wrong. Please try again.";

function getServerError(
  error: unknown,
  map: Partial<Record<ApiErrorCode, string>>,
): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null;
  const code = error.response?.data?.error?.code;
  if (!code) return FALLBACK_ERROR;
  return map[code] ?? FALLBACK_ERROR;
}

// ── SettingsTopbar ────────────────────────────────────────────────────────────

function SettingsTopbar({ workspaceName }: { workspaceName: string }) {
  return (
    <header className="h-14 flex items-center gap-2 px-4 lg:px-8 bg-background/70 backdrop-blur-md border-b border-outline-variant/10 sticky top-14 lg:top-0 z-30">
      <span className="hidden sm:block text-sm font-semibold text-on-surface-variant truncate max-w-40">
        {workspaceName}
      </span>
      <span className="hidden sm:block text-outline/40 text-sm">/</span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md",
          "text-xs font-semibold text-primary",
          "bg-primary/[0.08] border border-primary/[0.12]",
        )}
      >
        <Settings className="w-3 h-3" strokeWidth={2} />
        Settings
      </span>
    </header>
  );
}

// ── SectionCard ───────────────────────────────────────────────────────────────
// Shared wrapper: icon + title + description on top, hairline, action below

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}

function SectionCard({
  icon,
  title,
  description,
  children,
  danger = false,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden",
        danger
          ? "border-destructive/20 bg-destructive/[0.03]"
          : "border-outline-variant/15 bg-surface-container-low",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-start gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5",
          danger && "border-l-2 border-destructive/50",
        )}
      >
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
            danger
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : "bg-surface-container-highest text-on-surface-variant border border-outline-variant/20",
          )}
        >
          {icon}
        </div>
        <div>
          <h2
            className={cn(
              "font-display font-bold text-base leading-none mb-1.5",
              danger ? "text-destructive" : "text-on-surface",
            )}
          >
            {title}
          </h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Hairline */}
      <div
        className={cn(
          "h-px mx-6",
          danger ? "bg-destructive/10" : "bg-outline-variant/10",
        )}
      />

      {/* Action area */}
      <div className="px-4 sm:px-6 py-4 sm:py-5">{children}</div>
    </div>
  );
}

// ── RenameSection ─────────────────────────────────────────────────────────────

interface RenameSectionProps {
  workspaceId: string;
  currentName: string;
  canRename: boolean;
}

function RenameSection({
  workspaceId,
  currentName,
  canRename,
}: RenameSectionProps) {
  const {
    mutate: rename,
    isPending,
    error,
    isSuccess,
    reset,
  } = useRenameWorkspace(workspaceId);
  const serverError = getServerError(error, RENAME_ERROR_MESSAGES);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset: resetForm,
  } = useForm<RenameWorkspaceFormValues>({
    resolver: zodResolver(renameWorkspaceSchema),
    defaultValues: { name: currentName },
  });

  useEffect(() => {
    resetForm({ name: currentName });
  }, [currentName, resetForm]);

  function handleChange() {
    if (isSuccess) reset();
  }

  function onSubmit(data: RenameWorkspaceFormValues) {
    rename(data);
  }

  return (
    <SectionCard
      icon={<PenLine className="w-4 h-4" strokeWidth={2} />}
      title="Workspace name"
      description="Appears in the sidebar and all workspace communications. Visible to every member."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col sm:flex-row items-start gap-3 max-w-md">
          <div className="flex-1 space-y-1.5">
            <input
              {...register("name")}
              id="workspace-name"
              type="text"
              disabled={!canRename || isPending}
              onChange={(e) => {
                handleChange();
                register("name").onChange(e);
              }}
              className={cn(
                "w-full bg-surface-container-lowest rounded-xl px-4 py-2.5",
                "text-sm text-on-surface font-medium",
                "border border-outline-variant/20",
                "focus:outline-none focus:border-primary/40",
                "focus:shadow-[0_0_0_3px_oklch(0.82_0.14_198/10%)]",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                errors.name &&
                  "border-destructive/50 focus:border-destructive/60 focus:shadow-[0_0_0_3px_oklch(0.65_0.22_25/10%)]",
              )}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-[11px] font-medium text-destructive"
              >
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                {errors.name.message}
              </p>
            )}
            {serverError && (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-[11px] font-medium text-destructive"
              >
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                {serverError}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Saved chip — appears after success, disappears when dirty again */}
            {isSuccess && !isDirty && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20">
                <Check className="size-3" />
                Saved
              </span>
            )}

            <button
              type="submit"
              disabled={!canRename || isPending || !isDirty}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-bold",
                "bg-surface-container-highest text-on-surface",
                "border border-outline-variant/20",
                "hover:bg-surface-highest hover:border-outline-variant/35",
                "transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                "disabled:opacity-40 disabled:pointer-events-none",
              )}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>

        {!canRename && (
          <p className="mt-3 text-xs text-outline/70">
            Only admins and owners can rename the workspace.
          </p>
        )}
      </form>
    </SectionCard>
  );
}

// ── DangerZone ────────────────────────────────────────────────────────────────

interface DangerZoneProps {
  workspaceId: string;
  workspaceName: string;
  isOwner: boolean;
}

function DangerZone({ workspaceId, workspaceName, isOwner }: DangerZoneProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const {
    mutate: deleteWorkspace,
    isPending,
    error,
  } = useDeleteWorkspace(workspaceId);

  const serverError = getServerError(error, DELETE_ERROR_MESSAGES);
  const confirmMatches = confirmValue === workspaceName;

  function handleClose(open: boolean) {
    if (!open) setConfirmValue("");
    setDialogOpen(open);
  }

  function handleDelete() {
    if (!confirmMatches) return;
    deleteWorkspace();
  }

  return (
    <>
      <SectionCard
        icon={<AlertTriangle className="w-4 h-4" strokeWidth={2} />}
        title="Delete workspace"
        description="Permanently removes all boards, columns, cards, documents, and member access. This cannot be undone."
        danger
      >
        <div className="flex items-center justify-between">
          {isOwner ? (
            <button
              onClick={() => setDialogOpen(true)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-bold",
                "bg-destructive/10 text-destructive border border-destructive/20",
                "hover:bg-destructive hover:text-background hover:border-transparent",
                "flex items-center gap-2 transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
              )}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete workspace
            </button>
          ) : (
            <p className="text-sm text-outline/70">
              Only the workspace owner can delete this workspace.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Delete confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete workspace</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-on-surface">
                {workspaceName}
              </span>{" "}
              and all its contents. To confirm, type the workspace name below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 my-2">
            <label
              htmlFor="delete-confirm"
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-outline"
            >
              Type{" "}
              <span className="text-on-surface font-bold normal-case tracking-normal">
                {workspaceName}
              </span>{" "}
              to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              placeholder={workspaceName}
              autoComplete="off"
              className={cn(
                "w-full bg-surface-container-lowest rounded-xl px-4 py-2.5",
                "text-sm text-on-surface placeholder:text-outline/30",
                "border border-outline-variant/20",
                "focus:outline-none focus:border-destructive/40",
                "focus:shadow-[0_0_0_3px_oklch(0.65_0.22_25/10%)]",
                "transition-all duration-200",
                confirmMatches && "border-destructive/40",
              )}
            />
            {confirmValue.length > 0 && !confirmMatches && (
              <p className="text-[11px] text-outline/60">
                Keep typing — name must match exactly.
              </p>
            )}
            {confirmMatches && (
              <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                <AlertTriangle className="size-3 shrink-0" />
                Confirm below to permanently delete.
              </p>
            )}
          </div>

          {serverError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/8 border border-destructive/15">
              <AlertCircle
                className="size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => handleClose(false)}
              disabled={isPending}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "border border-outline-variant/20 text-on-surface-variant",
                "hover:bg-surface-container hover:text-on-surface",
                "transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                "disabled:opacity-50 disabled:pointer-events-none",
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!confirmMatches || isPending}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold",
                "bg-destructive/10 text-destructive border border-destructive/20",
                "hover:bg-destructive hover:text-background hover:border-transparent",
                "flex items-center gap-2 transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
                "disabled:opacity-40 disabled:pointer-events-none",
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Delete workspace
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── SettingsPage ──────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const currentUser = useAppSelector((state) => state.auth.user);

  const { data: workspace, isLoading } = useWorkspace(workspaceId);

  const currentMember = workspace?.members.find(
    (m) => m.user_id === currentUser?.id,
  );
  const viewerRole = currentMember?.role;
  const isOwner = viewerRole === "owner";
  const canRename = viewerRole === "owner" || viewerRole === "admin";

  if (isLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-outline" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <SettingsTopbar workspaceName={workspace?.name ?? ""} />

      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
          {/* ── Page heading ──────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary mb-2">
              Configuration
            </p>
            <h1 className="font-display text-[2rem] font-extrabold tracking-tight text-on-surface leading-none">
              Workspace Settings
            </h1>
          </div>

          {/* ── General section ───────────────────────────────────── */}
          <RenameSection
            workspaceId={workspaceId ?? ""}
            currentName={workspace?.name ?? ""}
            canRename={canRename}
          />

          {/* ── Danger zone ───────────────────────────────────────── */}
          <DangerZone
            workspaceId={workspaceId ?? ""}
            workspaceName={workspace?.name ?? ""}
            isOwner={isOwner}
          />
        </div>
      </div>
    </div>
  );
}
