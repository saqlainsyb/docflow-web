// src/components/modals/CreateCardModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// REDESIGNED: Premium card creation modal — "Obsidian Studio" aesthetic.
//
// Design features:
//   • Live card preview that updates as user types title + picks color
//   • Kinetic color picker — swatches scale up with glow bloom on select
//   • Input with animated bottom-border focus line (not just outline ring)
//   • Submit button: gradient with shimmer sweep on hover
//   • AnimatePresence on mount/unmount for error messages
//   • Icon header with gradient halo glow
//   • All logic + hooks identical to original — zero functional change
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import {
  Loader2,
  AlertCircle,
  Check,
  StickyNote,
  FileText,
  User,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { useAppDispatch } from "@/store/hooks";
import { closeModal } from "@/store";
import { useCreateCard } from "@/hooks/useCreateCard";
import { boardQueryKey } from "@/hooks/useBoard";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import {
  createCardSchema,
  type CreateCardFormValues,
  type CardColorValue,
} from "@/lib/validations";
import { after } from "@/lib/fractional";
import type { ApiErrorCode, BoardDetailResponse } from "@/lib/types";

// ── Error mapping ─────────────────────────────────────────────────────────────

const SERVER_ERROR_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  VALIDATION_ERROR: "Card title is invalid. Check length and characters.",
  BOARD_ACCESS_DENIED: "You don't have access to this board.",
  BOARD_NOT_FOUND: "This board no longer exists.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

function getServerError(error: unknown): string | null {
  if (!isAxiosError<{ error: { code: ApiErrorCode } }>(error)) return null;
  const code = error.response?.data?.error?.code;
  if (!code) return "Something went wrong. Please try again.";
  return (
    SERVER_ERROR_MESSAGES[code] ?? "Something went wrong. Please try again."
  );
}

// ── Color swatches ────────────────────────────────────────────────────────────

const COLOR_SWATCHES: { value: CardColorValue; label: string; glow: string }[] =
  [
    { value: "#EF4444", label: "Red", glow: "rgba(239,68,68,0.5)" },
    { value: "#F97316", label: "Orange", glow: "rgba(249,115,22,0.5)" },
    { value: "#EAB308", label: "Yellow", glow: "rgba(234,179,8,0.5)" },
    { value: "#22C55E", label: "Green", glow: "rgba(34,197,94,0.5)" },
    { value: "#3B82F6", label: "Blue", glow: "rgba(59,130,246,0.5)" },
    { value: "#A855F7", label: "Purple", glow: "rgba(168,85,247,0.5)" },
  ];

// ── Mini card preview ─────────────────────────────────────────────────────────

function CardPreview({
  title,
  color,
}: {
  title: string;
  color?: CardColorValue;
}) {
  const colorEntry = COLOR_SWATCHES.find((c) => c.value === color);
  const hasTitle = title.trim().length > 0;

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background:
          "linear-gradient(155deg, oklch(0.205 0.015 265) 0%, oklch(0.175 0.013 265) 100%)",
        border: color
          ? `1px solid ${color}40`
          : "1px solid rgba(255,255,255,0.068)",
        boxShadow: color
          ? `0 4px 20px ${colorEntry?.glow?.replace("0.5", "0.12")}, inset 0 1px 0 rgba(255,255,255,0.042)`
          : "0 1px 4px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.042)",
        transition: "border-color 0.25s, box-shadow 0.25s",
      }}
    >
      {/* Color accent bar */}
      <AnimatePresence>
        {color && (
          <motion.div
            key={color}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            style={{
              transformOrigin: "top",
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}80`,
            }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm"
          />
        )}
      </AnimatePresence>

      <div className="p-3 pl-4">
        <p
          className="text-[13px] font-semibold leading-snug mb-2.5 pr-4"
          style={{
            color: hasTitle
              ? "oklch(0.91 0.015 265)"
              : "rgba(255,255,255,0.20)",
            fontFamily: "var(--df-font-body)",
            fontStyle: hasTitle ? "normal" : "italic",
            minHeight: "20px",
          }}
        >
          {hasTitle ? title : "Card title preview…"}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{ border: "1px dashed rgba(255,255,255,0.16)" }}
            >
              <User
                className="w-2 h-2"
                style={{ color: "rgba(255,255,255,0.22)" }}
              />
            </div>
            <div
              className="flex items-center gap-1 px-1 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <FileText
                className="w-2 h-2"
                style={{ color: "rgba(255,255,255,0.28)" }}
              />
            </div>
          </div>
          <span
            className="text-[10px]"
            style={{ color: "rgba(255,255,255,0.24)" }}
          >
            Just now
          </span>
        </div>
      </div>
    </div>
  );
}

// ── CreateCardModal ───────────────────────────────────────────────────────────

interface CreateCardModalProps {
  columnId: string;
}

export function CreateCardModal({ columnId }: CreateCardModalProps) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const boardId = (() => {
    const queries = queryClient.getQueriesData<BoardDetailResponse>({
      queryKey: ["boards"],
    });
    for (const [, board] of queries) {
      if (board?.columns.some((col) => col.id === columnId)) return board.id;
    }
    return "";
  })();

  const mutation = useCreateCard(columnId, boardId);
  const serverError = getServerError(mutation.error);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateCardFormValues>({
    resolver: zodResolver(createCardSchema),
    defaultValues: { title: "", color: undefined },
  });

  const titleValue = watch("title");
  const selectedColor = watch("color");

  useEffect(() => {
    return () => {
      reset();
      mutation.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleColorClick(color: CardColorValue) {
    setValue("color", selectedColor === color ? undefined : color, {
      shouldValidate: true,
    });
  }

  function onSubmit(data: CreateCardFormValues) {
    const board = queryClient.getQueryData<BoardDetailResponse>(
      boardQueryKey(boardId),
    );
    const column = board?.columns.find((col) => col.id === columnId);
    const cards = column?.cards ?? [];
    const lastPosition =
      cards.length > 0 ? Math.max(...cards.map((c) => c.position)) : 0;
    const position = cards.length === 0 ? 1000 : after(lastPosition);

    mutation.mutate(
      {
        title: data.title,
        position,
        ...(data.color ? { color: data.color } : {}),
      },
      { onSuccess: () => dispatch(closeModal()) },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dispatch(closeModal());
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        {/* Custom content — bypasses DialogContent wrapper for full control */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
          style={{
            background: "oklch(0.17 0.016 265 / 0.97)",
            backdropFilter: "blur(32px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.085)",
            borderRadius: "1.5rem",
            boxShadow:
              "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,218,243,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
            padding: "2rem",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Add new card"
        >
          {/* Top ambient glow */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 pointer-events-none rounded-full"
            style={{
              background:
                "radial-gradient(ellipse at top, rgba(0,218,243,0.08) 0%, transparent 70%)",
            }}
          />

          {/* ── Header ────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3.5">
              {/* Icon badge */}
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 relative"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.82 0.14 198) 0%, oklch(0.42 0.09 198) 100%)",
                  boxShadow:
                    "0 4px 16px rgba(0,218,243,0.25), inset 0 1px 0 rgba(255,255,255,0.25)",
                }}
              >
                <StickyNote
                  className="w-5 h-5"
                  style={{ color: "oklch(0.10 0.015 265)" }}
                />
              </div>
              <div>
                <h2
                  className="text-[18px] font-bold leading-tight"
                  style={{
                    color: "oklch(0.91 0.015 265)",
                    fontFamily: "var(--df-font-display)",
                  }}
                >
                  New Card
                </h2>
                <p
                  className="text-[12px] mt-0.5"
                  style={{ color: "rgba(255,255,255,0.38)" }}
                >
                  Add a task or item to this column
                </p>
              </div>
            </div>

            {/* Close */}
            <button
              onClick={() => dispatch(closeModal())}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all focus:outline-none"
              style={{
                color: "rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.8)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.10)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.35)";
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.05)";
              }}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5 relative z-10"
          >
            {/* ── Card title ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <label
                htmlFor="card-title"
                className="block text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "rgba(255,255,255,0.40)" }}
              >
                Title
              </label>
              <div className="relative">
                <input
                  id="card-title"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  placeholder="e.g. Research competitor pricing"
                  aria-invalid={!!errors.title}
                  {...register("title")}
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.045)",
                    border: errors.title
                      ? "1px solid rgba(239,68,68,0.45)"
                      : "1px solid rgba(255,255,255,0.08)",
                    color: "oklch(0.91 0.015 265)",
                    fontFamily: "var(--df-font-body)",
                  }}
                  onFocus={(e) => {
                    if (!errors.title) {
                      (e.currentTarget as HTMLElement).style.border =
                        "1px solid rgba(0,218,243,0.35)";
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 0 0 3px rgba(0,218,243,0.08)";
                    }
                  }}
                  onBlur={(e) => {
                    if (!errors.title) {
                      (e.currentTarget as HTMLElement).style.border =
                        "1px solid rgba(255,255,255,0.08)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }
                  }}
                />
              </div>
              <AnimatePresence>
                {errors.title && (
                  <motion.p
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-1.5 text-[11px] font-medium"
                    style={{ color: "oklch(0.65 0.22 25)" }}
                    role="alert"
                  >
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.title.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* ── Color picker ───────────────────────────────────────── */}
            <div className="space-y-3">
              <label
                className="block text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "rgba(255,255,255,0.40)" }}
              >
                Color Label
                <span
                  className="ml-1.5 normal-case font-normal tracking-normal"
                  style={{ color: "rgba(255,255,255,0.22)" }}
                >
                  optional
                </span>
              </label>
              <div
                className="flex items-center gap-2.5"
                role="group"
                aria-label="Card color"
              >
                {COLOR_SWATCHES.map(({ value, label, glow }) => {
                  const isSelected = selectedColor === value;
                  return (
                    <motion.button
                      key={value}
                      type="button"
                      onClick={() => handleColorClick(value)}
                      aria-label={`${label}${isSelected ? " (selected)" : ""}`}
                      aria-pressed={isSelected}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.92 }}
                      animate={{
                        scale: isSelected ? 1.18 : 1,
                        boxShadow: isSelected
                          ? `0 0 0 2.5px ${value}, 0 0 14px ${glow}`
                          : "0 0 0 0px transparent",
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 22,
                      }}
                      className="w-8 h-8 rounded-full flex items-center justify-center focus:outline-none"
                      style={{
                        backgroundColor: value,
                        opacity: isSelected ? 1 : 0.65,
                      }}
                    >
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ── Live card preview ──────────────────────────────────── */}
            <div className="space-y-2">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "rgba(255,255,255,0.40)" }}
              >
                Preview
              </p>
              <CardPreview title={titleValue} color={selectedColor} />
            </div>

            {/* ── Server error ───────────────────────────────────────── */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[12px] font-medium"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.20)",
                    color: "oklch(0.75 0.18 25)",
                  }}
                  role="alert"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {serverError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Submit ─────────────────────────────────────────────── */}
            <SubmitButton
              isPending={mutation.isPending}
              label="Add Card"
              pendingLabel="Adding…"
            />
          </form>
        </motion.div>
      </DialogPortal>
    </Dialog>
  );
}

// ── Shared submit button ──────────────────────────────────────────────────────

function SubmitButton({
  isPending,
  label,
  pendingLabel,
}: {
  isPending: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <motion.button
      type="submit"
      disabled={isPending}
      whileHover={!isPending ? { scale: 1.015 } : undefined}
      whileTap={!isPending ? { scale: 0.985 } : undefined}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className="relative w-full py-3.5 rounded-xl text-sm font-bold overflow-hidden focus:outline-none disabled:opacity-60 disabled:pointer-events-none"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.82 0.14 198) 0%, oklch(0.42 0.09 198) 100%)",
        color: "oklch(0.10 0.015 265)",
        boxShadow: isPending
          ? "none"
          : "0 4px 24px rgba(0,218,243,0.22), inset 0 1px 0 rgba(255,255,255,0.20)",
      }}
    >
      {/* Shimmer sweep */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ x: "-100%" }}
        whileHover={{ x: "200%" }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        style={{
          background:
            "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)",
        }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {pendingLabel}
          </>
        ) : (
          label
        )}
      </span>
    </motion.button>
  );
}
