"use client";

// ============================================================
// Shared pieces for bulk actions in the admin console:
// selection bar, confirm dialog, credentials-result dialog, CSV download
// and a sequential runner with a progress toast.
// ============================================================

import type { ReactNode } from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function downloadCsv(name: string, header: string[], rows: string[][]) {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Runs `fn` for each item one after another, with a live progress toast. */
export async function runSequential<T, R>(
  items: T[],
  label: string,
  fn: (item: T) => Promise<R>
): Promise<{ done: { item: T; result: R }[]; failed: { item: T; error: string }[] }> {
  const id = `bulk-${Date.now()}`;
  const done: { item: T; result: R }[] = [];
  const failed: { item: T; error: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    toast.loading(`${label}… ${i + 1} of ${items.length}`, { id });
    try {
      done.push({ item: items[i], result: await fn(items[i]) });
    } catch (e) {
      failed.push({ item: items[i], error: e instanceof Error ? e.message : "Failed" });
    }
  }
  if (failed.length === 0) toast.success(`${label}: ${done.length} done`, { id });
  else toast.error(`${label}: ${done.length} done, ${failed.length} failed - ${failed[0].error}`, { id, duration: 6000 });
  return { done, failed };
}

export function BulkBar({
  count,
  onClear,
  busy,
  children,
}: {
  count: number;
  onClear: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky top-2 z-10 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary-50 px-3 py-2 shadow-sm"
    >
      <span className="text-sm font-semibold text-primary-700">{count} selected</span>
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        {busy ? <Loader2 className="size-4 animate-spin self-center text-primary-700" aria-hidden /> : null}
        {children}
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" onClick={onClear} disabled={busy}>
          <X className="size-3.5" aria-hidden />
          Clear
        </Button>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type Credential = { userId: string; name: string; password: string };

/** Shown when some credential emails could not be delivered. */
export function CredentialsDialog({ rows, onClose }: { rows: Credential[] | null; onClose: () => void }) {
  return (
    <Dialog open={rows !== null && rows.length > 0} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{rows?.length} password{rows && rows.length > 1 ? "s were" : " was"} not emailed</DialogTitle>
          <DialogDescription>
            Email sending isn't working right now, so give these to the members another way. They are shown only
            once - download them before closing.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-60 space-y-1 overflow-y-auto rounded-xl bg-surface-muted p-3 font-mono text-xs">
          {rows?.map((r) => (
            <li key={r.userId}>
              {r.userId} · {r.password} <span className="font-sans text-muted-foreground">({r.name})</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              downloadCsv(
                "uniprojects-credentials.csv",
                ["userId", "name", "password"],
                (rows ?? []).map((r) => [r.userId, r.name, r.password])
              )
            }
          >
            <Download className="size-4" aria-hidden />
            Download CSV
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
