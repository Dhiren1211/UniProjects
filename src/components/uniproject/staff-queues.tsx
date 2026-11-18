"use client";

// ============================================================
// Staff moderation queues - shared by the dashboards (professor /
// moderator) and the admin console's Moderation tab.
// Both cards self-fetch through the isStaff endpoints, so they
// work for every staff tier; the server scopes professors to
// their own sections and any 403 surfaces as a toast.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, Check, Eye, Flag, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchReports, fetchReviewQueue, fetchVerifications, resolveReport, type ReviewQueueItem } from "./api-client";
import type { ReportDTO, VerificationDTO } from "@/lib/types";
import { timeAgo } from "./ui-bits";

// ---------- approval queue (projects waiting to be published) ----------

export function ApprovalQueueCard({
  className,
  limit = 6,
  onReview,
}: {
  className?: string;
  /** Opens the project page - a preview with Approve / Request changes on top. */
  onReview: (slug: string) => void;
  limit?: number;
}) {
  const [rows, setRows] = useState<ReviewQueueItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchReviewQueue(ac.signal)
      .then(setRows)
      .catch(() => {
        if (!ac.signal.aborted) {
          setRows([]);
          setFailed(true);
        }
      });
    return () => ac.abort();
  }, []);

  return (
    <section
      className={cn("flex flex-col rounded-2xl border border-up-border bg-card p-5 shadow-card", className)}
      aria-label="Projects waiting for approval"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Waiting for approval</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            New projects stay hidden until you approve them. Open one to preview it.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums",
            rows && rows.length > 0 ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
          )}
        >
          {rows === null ? "…" : rows.length}
        </span>
      </div>

      {rows === null ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : failed ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Could not load the approval queue.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <BadgeCheck className="size-4 shrink-0 text-success" aria-hidden />
          Nothing to approve right now.
        </p>
      ) : (
        <ul className="nice-scroll mt-3 max-h-80 space-y-1 overflow-y-auto pr-0.5">
          {rows.slice(0, limit).map((p) => (
            <li key={p.id} className="rounded-xl border border-up-border bg-surface-muted/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onReview(p.slug)}
                    className="block max-w-full truncate text-left text-sm font-semibold text-foreground outline-none hover:text-primary-700 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {p.title}
                  </button>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.department.code}
                    {p.supervisor ? ` · ${p.supervisor}` : ""}
                    {p.submittedAt ? ` · sent ${timeAgo(p.submittedAt)}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-semibold"
                  onClick={() => onReview(p.slug)}
                >
                  <Eye className="size-3.5" aria-hidden />
                  Review
                </Button>
              </div>
            </li>
          ))}
          {rows.length > limit ? (
            <li className="px-1 pt-1 text-xs font-medium text-muted-foreground">+{rows.length - limit} more waiting</li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

// ---------- verification queue ----------

export function VerificationQueueCard({
  className,
  limit = 6,
  onReview,
}: {
  className?: string;
  /** Opens the project page, where the reviewer approves or rejects after looking at it. */
  onReview: (slug: string) => void;
  /** Max pending rows shown before a "+N more" caption. */
  limit?: number;
}) {
  const [rows, setRows] = useState<VerificationDTO[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setFailed(false);
    fetchVerifications()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const pending = rows?.filter((r) => r.status === "PENDING") ?? [];
  const decided = rows?.filter((r) => r.status !== "PENDING") ?? [];

  return (
    <section
      className={cn("flex flex-col rounded-2xl border border-up-border bg-card p-5 shadow-card", className)}
      aria-label="Verification queue"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Verification queue</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open each project to review it, then approve or reject on its page
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums",
            pending.length > 0 ? "bg-warning-soft text-warning" : "bg-success-soft text-success"
          )}
        >
          {rows === null ? "…" : pending.length}
        </span>
      </div>

      {rows === null ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : failed ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Could not load the queue - staff access is required.
        </p>
      ) : pending.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <BadgeCheck className="size-4 shrink-0 text-success" aria-hidden />
          {decided.length > 0
            ? `All caught up - ${decided.length} recent ${decided.length === 1 ? "decision" : "decisions"} below.`
            : "No verification requests right now."}
        </p>
      ) : (
        <ul className="nice-scroll mt-3 max-h-80 space-y-1 overflow-y-auto pr-0.5">
          {pending.slice(0, limit).map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-up-border bg-surface-muted/40 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onReview(row.project.slug)}
                    className="block max-w-full truncate text-left text-sm font-semibold text-foreground outline-none hover:text-primary-700 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {row.project.title}
                  </button>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {row.requester.displayName} · {timeAgo(row.createdAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 gap-1.5 rounded-lg px-3 text-xs font-semibold"
                  onClick={() => onReview(row.project.slug)}
                >
                  <Eye className="size-3.5" aria-hidden />
                  Review project
                </Button>
              </div>
            </li>
          ))}
          {pending.length > limit ? (
            <li className="px-1 pt-1 text-xs font-medium text-muted-foreground">
              +{pending.length - limit} more waiting
            </li>
          ) : null}
        </ul>
      )}

      {rows !== null && !failed && decided.length > 0 ? (
        <p className="mt-3 border-t border-up-border pt-2.5 text-[11px] text-muted-foreground">
          Most recent decision {timeAgo(decided[0].createdAt)} -{" "}
          {decided[0].status === "APPROVED" ? "approved" : "rejected"} “{decided[0].project.title}”
        </p>
      ) : null}
    </section>
  );
}

// ---------- open reports ----------

export function ReportsQueueCard({
  className,
  limit = 6,
}: {
  className?: string;
  limit?: number;
}) {
  const [rows, setRows] = useState<ReportDTO[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setFailed(false);
    fetchReports()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const resolve = async (row: ReportDTO) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      await resolveReport(row.id);
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === row.id ? { ...r, status: "RESOLVED" } : r)) : prev
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resolve the report");
    } finally {
      setBusyId(null);
    }
  };

  const open = rows?.filter((r) => r.status === "OPEN") ?? [];
  const resolved = rows?.filter((r) => r.status !== "OPEN") ?? [];

  return (
    <section
      className={cn("flex flex-col rounded-2xl border border-up-border bg-card p-5 shadow-card", className)}
      aria-label="Open reports"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Open reports</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Flagged projects and members awaiting review
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums",
            open.length > 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
          )}
        >
          {rows === null ? "…" : open.length}
        </span>
      </div>

      {rows === null ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : failed ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Could not load reports - staff access is required.
        </p>
      ) : open.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
          No open reports - the community is behaving.
        </p>
      ) : (
        <ul className="nice-scroll mt-3 max-h-80 space-y-1 overflow-y-auto pr-0.5">
          {open.slice(0, limit).map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-up-border bg-surface-muted/40 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                    <Flag className="size-3.5 shrink-0 text-danger" aria-hidden />
                    {row.targetLabel}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    “{row.reason}” · {row.reporter.displayName} · {timeAgo(row.createdAt)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold"
                  disabled={busyId === row.id}
                  onClick={() => resolve(row)}
                >
                  Resolve
                </Button>
              </div>
            </li>
          ))}
          {open.length > limit ? (
            <li className="px-1 pt-1 text-xs font-medium text-muted-foreground">
              +{open.length - limit} more open
            </li>
          ) : null}
        </ul>
      )}

      {rows !== null && !failed && resolved.length > 0 ? (
        <p className="mt-3 border-t border-up-border pt-2.5 text-[11px] text-muted-foreground">
          {resolved.length} resolved report{resolved.length === 1 ? "" : "s"} on record
        </p>
      ) : null}
    </section>
  );
}

/** Compact status pill pair for dashboards that only need counts (e.g. greeting rows). */
export function StaffQueueCounts({ className }: { className?: string }) {
  const [verifications, setVerifications] = useState<number | null>(null);
  const [reports, setReports] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVerifications()
      .then((rows) => {
        if (!cancelled) setVerifications(rows.filter((r) => r.status === "PENDING").length);
      })
      .catch(() => {
        if (!cancelled) setVerifications(0);
      });
    fetchReports()
      .then((rows) => {
        if (!cancelled) setReports(rows.filter((r) => r.status === "OPEN").length);
      })
      .catch(() => {
        if (!cancelled) setReports(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs font-semibold", className)}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-warning">
        <ShieldAlert className="size-3.5" aria-hidden />
        {verifications ?? "-"} to verify
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-danger">
        <Flag className="size-3.5" aria-hidden />
        {reports ?? "-"} open reports
      </span>
    </div>
  );
}
