// src/pages/auth/components/FormField.tsx
import { forwardRef } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  rightSlot?: React.ReactNode; // label row right side — "Forgot password?"
  icon?: React.ReactNode; // inside the input on the right — visibility toggle etc.
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, rightSlot, icon, className, id, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {/* Label row */}
        <div className="flex justify-between items-center ml-1">
          <label
            htmlFor={id}
            className="text-[10px] font-medium uppercase tracking-[0.15em] text-on-surface-variant"
          >
            {label}
          </label>
          {rightSlot}
        </div>

        {/* Input + icon + focus glow */}
        <div className="relative group flex items-center">
          <input
            ref={ref}
            id={id}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(
              "w-full rounded-lg py-4 px-4",
              "bg-surface-lowest",
              "text-foreground placeholder:text-(--df-on-surface-variant)/40",
              "border-none outline-none",
              "transition-all duration-300",
              icon && "pr-11",
              error && "ring-1 ring-destructive/50",
              className,
            )}
            {...props}
          />

          {/* Icon sits as a flex sibling, pulled left with absolute */}
          {icon && (
            <div className="absolute right-4 flex items-center justify-center">
              {icon}
            </div>
          )}

          {/* Focus glow overlay */}
          <div
            className={cn(
              "absolute inset-0 rounded-lg pointer-events-none",
              "border border-secondary/20",
              "opacity-0 group-focus-within:opacity-100",
              "shadow-[0_0_15px_rgba(205,189,255,0.15)]",
              "transition-opacity duration-300",
            )}
          />
        </div>

        {/* Error message */}
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="flex items-center gap-1 ml-1 text-[11px] font-medium text-destructive"
          >
            <AlertCircle className="size-3 shrink-0" />
            {error}
          </p>
        )}
      </div>
    );
  },
);

FormField.displayName = "FormField";
