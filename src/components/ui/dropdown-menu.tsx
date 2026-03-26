import * as React from 'react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { Check, ChevronRight, Circle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * DropdownMenu
 *
 * Thin shadcn-style wrapper over Radix UI DropdownMenu.
 * Styled with --df-* tokens to match the Docflow design system.
 *
 * Exports the full Radix surface: Root, Trigger, Content, Item,
 * Separator, Label, Sub, SubTrigger, SubContent, CheckboxItem,
 * RadioGroup, RadioItem, Shortcut.
 */

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

// ── SubTrigger ────────────────────────────────────────────────────────────────

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        'flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none',
        'text-on-surface transition-colors duration-100',
        'focus:bg-surface-container data-[state=open]:bg-surface-container',
        'data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0',
        '[&_svg:not([class*="size-"])]:size-4',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

// ── SubContent ────────────────────────────────────────────────────────────────

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-xl p-1',
        'border border-outline-variant/15',
        'bg-surface-container-highest/95 backdrop-blur-xl',
        'text-on-surface shadow-ambient',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[10rem] overflow-hidden rounded-xl p-1',
          'border border-outline-variant/15',
          'bg-surface-container-highest/95 backdrop-blur-xl',
          'text-on-surface shadow-ambient',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

// ── Item ──────────────────────────────────────────────────────────────────────

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none',
        'transition-colors duration-100',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        '[&_svg:not([class*="size-"])]:size-4',
        'data-[inset]:pl-8',
        // Default variant
        variant === 'default' && [
          'text-on-surface',
          'focus:bg-surface-container focus:text-on-surface',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        ],
        // Destructive variant
        variant === 'destructive' && [
          'text-destructive',
          'focus:bg-destructive/10 focus:text-destructive',
          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        ],
        className,
      )}
      {...props}
    />
  )
}

// ── CheckboxItem ──────────────────────────────────────────────────────────────

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm outline-none',
        'text-on-surface transition-colors duration-100',
        'focus:bg-surface-container',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-3.5" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

// ── RadioItem ─────────────────────────────────────────────────────────────────

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm outline-none',
        'text-on-surface transition-colors duration-100',
        'focus:bg-surface-container',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

// ── Label ─────────────────────────────────────────────────────────────────────

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        'px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-outline',
        'data-[inset]:pl-8',
        className,
      )}
      {...props}
    />
  )
}

// ── Separator ─────────────────────────────────────────────────────────────────

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('my-1 h-px bg-outline-variant/15', className)}
      {...props}
    />
  )
}

// ── Shortcut ──────────────────────────────────────────────────────────────────

function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        'ml-auto text-xs tracking-widest text-outline opacity-60',
        className,
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
}