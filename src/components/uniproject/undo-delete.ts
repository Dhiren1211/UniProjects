"use client";

// ============================================================
// Delete with a 5-second undo.
// The item disappears from the UI at once (onHide) and a toast counts down
// with an "Undo" button. Only when the countdown ends is the real delete
// request sent (commit). Undo - or a failed request - puts the item back
// (onRestore). Nothing is removed on the server until the countdown ends.
// ============================================================

import { toast } from "sonner";

const UNDO_SECONDS = 5;

// Deletions still counting down. If the tab is closed meanwhile they are simply
// not sent (the safe outcome), and the browser asks the user to confirm leaving.
const pending = new Set<string>();
let unloadGuard = false;

function guardUnload() {
  if (unloadGuard || typeof window === "undefined") return;
  unloadGuard = true;
  window.addEventListener("beforeunload", (e) => {
    if (pending.size > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

export function deleteWithUndo(opts: {
  /** What is being deleted, e.g. “Announcement” or “@jisoo”. */
  label: string;
  /** Sends the real delete request. */
  commit: () => Promise<unknown>;
  /** Remove the item from the UI right away. */
  onHide?: () => void;
  /** Put the item back (Undo, or the request failed). */
  onRestore?: () => void;
  /** After the server confirmed the delete. */
  onDeleted?: () => void;
  /** Message on success (default: “<label> deleted”). */
  doneMessage?: string;
}): void {
  guardUnload();
  const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  pending.add(id);
  let left = UNDO_SECONDS;
  let settled = false;

  const render = () =>
    toast(`Deleting ${opts.label}`, {
      id,
      description: `Undo within ${left}s`,
      duration: Infinity,
      action: { label: "Undo", onClick: undo },
    });

  const finish = () => {
    settled = true;
    pending.delete(id);
    window.clearInterval(tick);
  };

  function undo() {
    if (settled) return;
    finish();
    opts.onRestore?.();
    toast.success(`Kept ${opts.label}`, { id, description: undefined, action: undefined, duration: 2500 });
  }

  const tick = window.setInterval(() => {
    if (settled) return;
    left -= 1;
    if (left > 0) {
      render();
      return;
    }
    finish();
    toast.loading(`Deleting ${opts.label}…`, { id, description: undefined, action: undefined });
    opts
      .commit()
      .then(() => {
        toast.success(opts.doneMessage ?? `${opts.label} deleted`, { id, duration: 3000 });
        opts.onDeleted?.();
      })
      .catch((e: unknown) => {
        opts.onRestore?.();
        toast.error(e instanceof Error ? e.message : `Could not delete ${opts.label}`, {
          id,
          duration: 5000,
        });
      });
  }, 1000);

  opts.onHide?.();
  render();
}

/** Re-insert an item at its old position (for restoring list rows). */
export function restoreAt<T extends { id: string }>(list: T[] | null, item: T, index: number): T[] | null {
  if (!list || list.some((x) => x.id === item.id)) return list;
  const next = list.slice();
  next.splice(Math.min(index, next.length), 0, item);
  return next;
}
