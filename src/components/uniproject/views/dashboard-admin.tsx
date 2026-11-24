"use client";

// ============================================================
// ADMIN dashboard - overview stats, quick actions into the
// console (deep-linking the right tab) and a live activity
// mini-feed. Split out of dashboard.tsx to keep the router file
// lean; layout chrome comes from dashboard-bits.
// ============================================================

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  FolderKanban,
  GraduationCap,
  ListChecks,
  Megaphone,
  Settings2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchAdminOverview, type Navigate } from "../api-client";
import { EmptyState, timeAgo } from "../ui-bits";
import type { AdminActivityItem, AdminOverviewDTO, SafeUserDTO } from "@/lib/types";
import { FadeIn, IdentityCard } from "./dashboard-bits";

const ACTIVITY_ICONS: Record<AdminActivityItem["kind"], typeof FolderKanban> = {
  PROJECT: FolderKanban,
  USER: UsersRound,
  COMMENT: UsersRound,
  REPORT: ShieldCheck,
  JOIN: UsersRound,
  ACCOUNT_REQUEST: ListChecks,
  RESOURCE: FolderKanban,
};

const ADMIN_ACTION_ICONS = {
  approvals: ListChecks,
  users: UsersRound,
  settings: Settings2,
  announcements: Megaphone,
} as const;

export function AdminDashboard({ user, navigate }: { user: SafeUserDTO; navigate: Navigate }) {
  const [overview, setOverview] = useState<AdminOverviewDTO | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAdminOverview()
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goAdmin = (tab?: string) => navigate({ name: "admin", tab });

  const tiles = overview
    ? [
        {
          label: "Pending approvals",
          value: overview.pendingAccountRequests,
          icon: ListChecks,
          go: () => goAdmin("approvals"),
          tone:
            overview.pendingAccountRequests > 0
              ? "bg-warning-soft text-warning"
              : "bg-success-soft text-success",
        },
        {
          label: "To verify",
          value: overview.pendingVerifications,
          icon: BadgeCheck,
          go: () => goAdmin("moderation"),
          tone:
            overview.pendingVerifications > 0
              ? "bg-warning-soft text-warning"
              : "bg-success-soft text-success",
        },
        {
          label: "Open reports",
          value: overview.openReports,
          icon: ShieldCheck,
          go: () => goAdmin("moderation"),
          tone: overview.openReports > 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success",
        },
        {
          label: "Students",
          value: overview.students,
          icon: GraduationCap,
          go: () => goAdmin("users"),
          tone: "bg-primary-50 text-primary-700",
        },
        {
          label: "Projects",
          value: overview.projects,
          icon: FolderKanban,
          go: () => goAdmin("projects"),
          tone: "bg-primary-50 text-primary-700",
        },
      ]
    : [];

  const quickActions: {
    key: keyof typeof ADMIN_ACTION_ICONS;
    label: string;
    hint: string;
    tab: string;
  }[] = [
    {
      key: "approvals",
      label: "Review account requests",
      hint: "Approve or reject student intake",
      tab: "approvals",
    },
    { key: "users", label: "Manage users", hint: "Roles, sections and team leaders", tab: "users" },
    { key: "settings", label: "Site settings", hint: "Search, signups and hero copy", tab: "settings" },
    { key: "announcements", label: "Announcements", hint: "Post campus-wide news", tab: "announcements" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <FadeIn className="min-w-0 space-y-4" delay={0.05}>
        {/* stats row */}
        {failed ? (
          <EmptyState
            icon={ShieldCheck}
            title="Couldn't load the overview"
            hint="The admin overview API did not respond - try the admin console directly."
            action={
              <Button onClick={() => goAdmin()} className="rounded-xl font-semibold">
                Open admin panel
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {tiles.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={t.go}
                  className="group rounded-2xl border border-up-border bg-card p-4 text-left shadow-card outline-none transition-colors hover:border-up-border-strong focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn("flex size-9 items-center justify-center rounded-xl", t.tone)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                    {overview ? t.value.toLocaleString() : <Skeleton className="h-7 w-12" />}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-foreground">{t.label}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* quick actions */}
        <section
          aria-label="Quick actions"
          className="rounded-2xl border border-up-border bg-card p-5 shadow-card"
        >
          <h2 className="text-sm font-bold tracking-tight text-foreground">Quick actions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The most common console tasks, one click away
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {quickActions.map((a) => {
              const Icon = ADMIN_ACTION_ICONS[a.key];
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => goAdmin(a.tab)}
                  className="group flex items-center gap-2.5 rounded-xl border border-up-border bg-surface-muted/50 p-2.5 text-left transition-colors hover:border-up-border-strong hover:bg-primary-50/70"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-card text-primary-700 shadow-sm ring-1 ring-up-border">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary-700">
                      {a.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{a.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* recent activity */}
        <section
          aria-label="Recent activity"
          className="rounded-2xl border border-up-border bg-card p-5 shadow-card"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold tracking-tight text-foreground">Recent activity</h2>
            <button
              type="button"
              onClick={() => goAdmin()}
              className="text-xs font-bold text-primary-700 transition-colors hover:text-primary-600"
            >
              Open admin panel
            </button>
          </div>
          {overview === null ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : overview.activity.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing has happened yet - activity lands here as members work.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-up-border">
              {overview.activity.slice(0, 5).map((item) => {
                const Icon = ACTIVITY_ICONS[item.kind] ?? FolderKanban;
                return (
                  <li key={item.id} className="flex items-center gap-3 py-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {item.text}
                      </span>
                      {item.detail ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[0.75rem] font-medium text-muted-foreground">
                      {timeAgo(item.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </FadeIn>

      <FadeIn className="min-w-0 space-y-4" delay={0.1}>
        <IdentityCard user={user} />
        <section
          aria-label="Console shortcut"
          className="rounded-2xl border border-up-border bg-night p-5 text-white shadow-card"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
            <ShieldCheck className="size-4.5" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-bold">Full console access</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Approvals, users, projects, announcements, moderation, emails and site settings.
          </p>
          <Button
            onClick={() => goAdmin()}
            variant="outline"
            className="mt-4 w-full rounded-xl border-white/15 bg-white/10 font-semibold text-white hover:bg-white/20 hover:text-white"
          >
            Open admin panel
          </Button>
        </section>
      </FadeIn>
    </div>
  );
}
