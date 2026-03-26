import * as React from 'react'
import { Select as SelectPrimitive } from 'radix-ui'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Select
 *
 * Thin shadcn-style wrapper over Radix UI Select.
 * Styled with --df-* tokens to match the Docflow design system.
 *
 * Usage:
 *   <Select value={value} onValueChange={setValue}>
 *     <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="admin">Admin</SelectItem>
 *       <SelectItem value="member">Member</SelectItem>
 *     </SelectContent>
 *   </Select>
 */

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

// ── Trigger ───────────────────────────────────────────────────────────────────

function SelectTrigger({
  className,
  children,
  size = 'default',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: 'default' | 'sm'
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'flex items-center justify-between gap-2 w-full rounded-lg',
        'border border-outline-variant/20 bg-surface-container',
        'text-sm text-on-surface whitespace-nowrap',
        'transition-colors duration-150 outline-none',
        'hover:bg-surface-container-high',
        'focus-visible:ring-2 focus-visible:ring-primary/50',
        'disabled:pointer-events-none disabled:opacity-50',
        'aria-invalid:border-destructive',
        // Sizes
        size === 'default' && 'h-9 px-3 py-2',
        size === 'sm' && 'h-7 px-2 py-1 text-xs',
        // Arrow icon
        '[&>span]:line-clamp-1 [&>span]:text-left [&>span]:flex-1',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="size-4 text-outline shrink-0 opacity-60"
          aria-hidden="true"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

// ── ScrollUpButton ────────────────────────────────────────────────────────────

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-outline',
        className,
      )}
      {...props}
    >
      <ChevronUp className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  )
}

// ── ScrollDownButton ──────────────────────────────────────────────────────────

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-outline',
        className,
      )}
      {...props}
    >
      <ChevronDown className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(
          'relative z-50 max-h-[--radix-select-content-available-height]',
          'min-w-32 overflow-y-auto overflow-x-hidden',
          'rounded-xl border border-outline-variant/15 p-1',
          'bg-surface-container-highest/95 backdrop-blur-xl',
          'text-on-surface shadow-ambient',
          // Animations
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2',
          'data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2',
          'data-[side=top]:slide-in-from-bottom-2',
          // Popper alignment offset
          position === 'popper' && [
            'w-[--radix-select-trigger-width]',
            'data-[side=bottom]:translate-y-1',
            'data-[side=top]:-translate-y-1',
          ],
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            position === 'popper' &&
              'h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

// ── Label ─────────────────────────────────────────────────────────────────────

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        'px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-outline',
        className,
      )}
      {...props}
    />
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-default select-none items-center gap-2',
        'rounded-lg py-1.5 pr-8 pl-2 text-sm outline-none',
        'text-on-surface transition-colors duration-100',
        'focus:bg-surface-container focus:text-on-surface',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {/* Check indicator — right-aligned */}
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5 text-primary" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

// ── Separator ─────────────────────────────────────────────────────────────────

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('my-1 h-px bg-outline-variant/15', className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}