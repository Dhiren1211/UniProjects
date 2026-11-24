"use client";

// ============================================================
// Announcements - read-only notices from the capstone office.
// Same page frame as Guidelines: full-width header, then one
// row per notice (date on the left, the notice on the right).
// Pinned notices first (server-ordered). Editing lives in the
// admin panel.
// ============================================================

import { useEffect, useState } from "react";
import { AlertTriangle, Megaphone, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UNIVERSITY } from "@/lib/config";
import { fetchAnnouncements, type AnnouncementDTO } from "../api-client";
import { EmptyState } from "../ui-bits";
import { formatDate } from "../format";

export function AnnouncementsView() {
  const [rows, setRows] = useState<AnnouncementDTO[] | null>(null); // null = loading
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    fetchAnnouncements(ac.signal)
      .then((list) => {
        setRows(list);
        setFailed(false);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setRows([]);
        setFailed(true);
      });
    return () => ac.abort();
  }, [retry]);

  const pinnedCount = rows?.filter((a) => a.pinned).length ?? 0;

  return (
    <>
      {/* ---------- page header ---------- */}
      <header className="border-b border-up-border">
        <div className="wrap py-14 md:py-20">
          <p className="t-label">{UNIVERSITY.name} · Capstone office</p>
          <h1 className="mt-4 text-[2.125rem] leading-[1.08] text-foreground md:text-[3rem]">Announcements</h1>
          <p className="mt-4 max-w-[62ch] text-lg leading-8 text-ink-700">
            Updates from the capstone office: deadlines, review windows and showcase news.
            {rows && rows.length > 0
              ? ` ${rows.length} ${rows.length === 1 ? "notice" : "notices"}${pinnedCount ? `, ${pinnedCount} pinned` : ""}.`
              : ""}
          </p>
        </div>
      </header>

      {/* ---------- list ---------- */}
      <div className="wrap py-10 md:py-14">
        {rows === null ? (
          <ul aria-busy="true" aria-label="Loading announcements">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="grid gap-3 border-b border-up-border py-8 lg:grid-cols-12 lg:gap-6">
                <Skeleton className="h-4 w-28 lg:col-span-3" />
                <div className="lg:col-span-8 lg:col-start-5">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="mt-4 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-4/5" />
                </div>
              </li>
            ))}
          </ul>
        ) : failed ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load announcements"
            hint="Check your connection and try again."
            action={
              <Button
                onClick={() => {
                  setRows(null);
                  setRetry((r) => r + 1);
                }}
                variant="outline"
              >
                Try again
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            hint="When the capstone office posts an update, it will appear here."
          />
        ) : (
          <ol>
            {rows.map((a) => {
              const edited = a.updatedAt && a.updatedAt !== a.createdAt;
              return (
                <li
                  key={a.id}
                  className="grid gap-3 border-b border-up-border py-8 first:pt-2 last:border-b-0 lg:grid-cols-12 lg:gap-6"
                >
                  {/* meta column */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:col-span-3 lg:flex-col lg:items-start">
                    <time dateTime={a.createdAt} className="font-mono text-[0.875rem] text-ink-500">
                      {formatDate(a.createdAt)}
                    </time>
                    {a.pinned ? (
                      <span className="inline-flex items-center gap-1 text-[0.875rem] font-medium text-primary-700">
                        <Pin className="size-3.5" aria-hidden />
                        Pinned
                      </span>
                    ) : null}
                  </div>

                  {/* notice */}
                  <article className="min-w-0 lg:col-span-8 lg:col-start-5">
                    <h2 className="text-xl leading-snug text-foreground md:text-[1.375rem]">{a.title}</h2>
                    <p className="mt-3 max-w-[68ch] whitespace-pre-line text-base leading-7 text-ink-700">
                      {a.body}
                    </p>
                    {edited ? (
                      <p className="mt-3 text-[0.875rem] text-ink-500">Edited {formatDate(a.updatedAt)}</p>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
