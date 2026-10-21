/**
 * Reordering rules for the overview (`cms-panel-shell.AC10`). Pure, so the keyboard and drag
 * paths share one tested implementation.
 */

/** `order` with `type` moved by `delta` places; unchanged when the move would leave the list. */
export function moveBy(order: readonly string[], type: string, delta: number): string[] {
  const from = order.indexOf(type);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= order.length || delta === 0) return [...order];
  return moveTo(order, from, to);
}

/** `order` with the item at `from` placed at `to`. */
export function moveTo(order: readonly string[], from: number, to: number): string[] {
  const next = [...order];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...order];
  next.splice(to, 0, moved);
  return next;
}
