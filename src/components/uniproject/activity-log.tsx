"use client";

// ============================================================
// Admin → Activity: the audit trail of staff actions.
// Search, filter by area, and page back with "Load more".
// ============================================================

import { useEffect, useState } from "react";
import { History, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchActivity, type AuditEntry } from "./api-client";
import { EmptyState, timeAgo } from "./ui-bits";

const AREAS = [
  { value: "ALL", label: "Everything" },
  { value: "project", label: "Projects" },
  { value: "user", label: "Members" },
  { value: "users", label: "Imports" },
  { value: "request", label: "Account requests" },
  { value: "password", label: "Password resets" },
  { value: "announcement", label: "Announcements" },
  { value: "department", label: "Departments" },
  { value: "verification", label: "Verifications" },
  { value: "report", label: "Reports" },
  { value: "settings", label: "Settings" },
];

/** "project.approve" → "approved project" */
const VERBS: Record<string, string> = {
  "project.approve": "approved project",
  "project.reject": "requested changes on",
  "project.unpublish": "unpublished",
  "project.update": "updated project",
  "project.delete": "deleted project",
  "user.create": "created member",
  "user.update": "edited member",
  "user.delete": "deleted member",
  "users.import": "imported",
  "request.approve": "approved the account request of",
  "request.reject": "rejected the account request of",
  "request.delete": "deleted the account request of",
  "password.reset": "reset the password of",
  "password.dismiss": "dismissed a reset request from",
  "announcement.create": "posted announcement",
  "announcement.update": "edited announcement",
  "announcement.delete": "deleted announcement",
  "department.create": "added department",
  "department.update": "edited department",
  "department.delete": "deleted department",
  "verification.approve": "verified",
  "verification.reject": "rejected verification of",
  "report.resolved": "resolved a report",
  "report.dismissed": "dismissed a report",
  "report.open": "reopened a report",
  "settings.update": "changed",
};

function tone(action: string) {
  if (action.endsWith(".delete") || action.endsWith(".reject")) return "bg-danger";
  if (action.endsWith(".approve") || action.endsWith(".create") || action === "users.import") return "bg-success";
  if (action.startsWith("password.")) return "bg-warning";
  return "bg-primary";
}

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export function ActivityLog({
  refreshTick,
  onLoaded,
}: {
  refreshTick: number;
  onLoaded?: (ok: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const [area, setArea] = useState("ALL");
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchActivity({ q, area }, ac.signal)
      .then((d) => {
        setEntries(d.entries);
        setHasMore(d.hasMore);
        onLoaded?.(true);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setEntries([]);
        onLoaded?.(false);
        toast.error(e instanceof Error ? e.message : "Could not load the activity log");
      });
    return () => ac.abort();
  }, [q, area, refreshTick, onLoaded]);

  const loadMore = () => {
    if (!entries?.length) return;
    setLoadingMore(true);
    fetchActivity({ q, area, before: entries[entries.length - 1].createdAt })
      .then((d) => {
        setEntries((prev) => [...(prev ?? []), ...d.entries]);
        setHasMore(d.hasMore);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load more"))
      .finally(() => setLoadingMore(false));
  };

  const filtering = q.trim() !== "" || area !== "ALL";

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by person, project, member or detail"
            aria-label="Search the activity log"
            className="h-9 rounded-xl pl-9"
          />
        </div>
        <Select
          value={area}
          onValueChange={(v) => {
            setArea(v);
            setEntries(null);
          }}
        >
          <SelectTrigger className="h-9 w-full rounded-xl sm:w-[190px]" aria-label="Filter by area">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AREAS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entries === null ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={History}
            title={filtering ? "Nothing matches" : "No activity yet"}
            hint={
              filtering
                ? "Try a different search or area."
                : "Approvals, resets, deletions and setting changes are recorded here as they happen."
            }
          />
        </div>
      ) : (
        <>
          <ol className="mt-3 divide-y divide-up-border rounded-xl border border-up-border bg-card">
            {entries.map((e) => (
              <li key={e.id} className="flex gap-3 px-3.5 py-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", tone(e.action))} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{e.actorName}</span>{" "}
                    <span className="text-muted-foreground">{VERBS[e.action] ?? e.action}</span>{" "}
                    <span className="font-medium">{e.targetLabel}</span>
                  </p>
                  {e.details ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground" title={e.details}>
                      {e.details}
                    </p>
                  ) : null}
                </div>
                <time
                  dateTime={e.createdAt}
                  title={new Date(e.createdAt).toLocaleString()}
                  className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                >
                  {timeAgo(e.createdAt)}
                </time>
              </li>
            ))}
          </ol>
          {hasMore ? (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2 rounded-xl">
                {loadingMore ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
