// ─────────────────────────────────────────────────────────────────────────────
// Fractional indexing utilities for column and card ordering.
//
// The backend stores whatever float64 position it receives — all ordering
// logic lives here on the frontend. This keeps the server dumb and the
// client authoritative about where things go.
//
// Strategy:
//   - Initial positions: 1000, 2000, 3000, …  (STEP apart)
//   - Insert between A and B: (A + B) / 2
//   - Insert before first:    first / 2
//   - Insert after last:      last + STEP
//   - Rebalance when any adjacent gap falls below GAP_THRESHOLD
//
// Why float64 / JavaScript number:
//   JavaScript's number is IEEE 754 double (64-bit float), identical to Go's
//   float64. We have ~15 significant decimal digits of precision before gaps
//   become indistinguishable. At STEP=1000 we can bisect ~50 times before
//   hitting the threshold — far more than any real-world list needs.
// ─────────────────────────────────────────────────────────────────────────────

/** Gap below which we consider the ordering degraded and trigger a rebalance. */
const GAP_THRESHOLD = 0.001

/** Distance added when appending after the last item. */
const STEP = 1000

/**
 * Returns the midpoint between two positions.
 * Use when inserting an item between two existing items.
 *
 * Precondition: a < b
 */
export function between(a: number, b: number): number {
  return (a + b) / 2
}

/**
 * Returns a position before the current first item.
 * Use when inserting at the head of a list.
 *
 * Precondition: first > 0 (always true — backend enforces gt=0)
 */
export function before(first: number): number {
  return first / 2
}

/**
 * Returns a position after the current last item.
 * Use when appending to the tail of a list.
 */
export function after(last: number): number {
  return last + STEP
}

/**
 * Returns true if any adjacent gap in the sorted position list
 * falls below GAP_THRESHOLD — meaning a rebalance is needed.
 *
 * Expects positions already sorted ascending. Lists with fewer than
 * 2 items have no gaps, so this always returns false for them.
 */
export function needsRebalance(sortedPositions: number[]): boolean {
  for (let i = 1; i < sortedPositions.length; i++) {
    if (sortedPositions[i] - sortedPositions[i - 1] < GAP_THRESHOLD) return true
  }
  return false
}

/**
 * Generates fresh evenly-spaced positions for `count` items.
 * Returns [STEP, STEP*2, …, STEP*count].
 *
 * Call this when needsRebalance() returns true, then PATCH each
 * item with its new position at index i → result[i].
 * The caller is responsible for sending the server updates.
 */
export function rebalance(count: number): number[] {
  return Array.from({ length: count }, (_, i) => STEP * (i + 1))
}