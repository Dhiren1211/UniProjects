"use client";

// ============================================================
// Dashboard - the signed-in home base, one experience per role.
//   STUDENT    identity + team/submit state + security nudge
//   PROFESSOR  verification queue + open reports (own sections)
//   MODERATOR  same queues + admin-panel shortcut (limited tabs)
//   ADMIN      overview stats + quick actions (dashboard-admin)
// Guests get a friendly sign-in prompt. Staff queues live in
// ../staff-queues and are shared with the admin Moderation tab.
// ============================================================

import { useEffect, useState } from "react";
import { Eye, FolderKanban, KeyRound, Mail, ShieldCheck, SquarePlus, Users, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchJoinRequests,
  fetchProjects,
  type Navigate,
} from "../api-client";
import { canSubmit, useAppStore } from "../store";
import { ApprovalQueueCard, ReportsQueueCard, VerificationQueueCard } from "../staff-queues";
import { StatusBadge, VerifiedBadge, formatViews } from "../ui-bits";
import type { ProjectListItem, SafeUserDTO } from "@/lib/types";
import { FadeIn, IdentityCard, PageHeader } from "./dashboard-bits";
import { AdminDashboard } from "./dashboard-admin";

// ============================================================
// STUDENT
// ============================================================

function StudentDashboard({ user, navigate }: { user: SafeUserDTO; navigate: Navigate }) {
  const isLeader = user.isTeamLeader;
  const [project, setProject] = useState<ProjectListItem | null | undefined>(undefined);
  // pending join-request counts per project slug - null means "not known yet"
  const [joinsBySlug, setJoinsBySlug] = useState<Record<string, number>>({});

  // my most relevant project (owned + memberships), newest first
  useEffect(() => {
    let cancelled = false;
    fetchProjects({ status: "MINE", limit: 1 })
      .then((rows) => {
        if (!cancelled) setProject(rows[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // team leaders also watch incoming join requests for their project
  const slug = project?.slug;
  useEffect(() => {
    if (!isLeader || !slug) return;
    let cancelled = false;
    fetchJoinRequests(slug)
      .then((rows) => {
        if (!cancelled)
          setJoinsBySlug((prev) => ({
            ...prev,
            [slug]: rows.filter((r) => r.status === "PENDING").length,
          }));
      })
      .catch(() => {
        if (!cancelled) setJoinsBySlug((prev) => ({ ...prev, [slug]: 0 }));
      });
    return () => {
      cancelled = true;
    };
  }, [isLeader, slug]);

  const pendingJoins = slug ? (joinsBySlug[slug] ?? null) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <FadeIn className="min-w-0 space-y-4" delay={0.05}>
        {/* ---------- my team ---------- */}
        <section aria-label="My team" className="rounded-2xl border border-up-border bg-card p-5 shadow-card">
          <h2 className="text-sm font-bold tracking-tight text-foreground">My team</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Your capstone project and its status</p>

          {project === undefined ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-9 w-2/3 rounded-xl" />
            </div>
          ) : project === null ? (
            isLeader ? (
              <div className="mt-4 rounded-2xl border border-dashed border-up-border-strong bg-surface-muted/40 p-6 text-center">
                <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
                  <SquarePlus className="size-5" aria-hidden />
                </span>
                <p className="mt-3 font-semibold text-foreground">No project yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  You lead your team - submit your capstone project when it is ready for the showcase.
                </p>
                <Button
                  onClick={() => navigate({ name: "create" })}
                  className="mt-4 gap-2 rounded-xl px-5 font-semibold"
                >
                  <SquarePlus className="size-4" aria-hidden />
                  Submit your project
                </Button>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-up-border-strong bg-surface-muted/40 p-6 text-center">
                <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground">
                  <UsersRound className="size-5" aria-hidden />
                </span>
                <p className="mt-3 font-semibold text-foreground">Waiting on your team leader</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Your team leader submits the project - ask them to publish it so your team shows up
                  in the showcase.
                </p>
              </div>
            )
          ) : (
            <div className="mt-4">
              <article className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-up-border bg-surface-muted/30 p-3">
                {project.coverImage ? (
                  <img
                    src={project.coverImage}
                    alt=""
                    loading="lazy"
                    className="size-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"
                  >
                    <FolderKanban className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1 basis-48">
                  <button
                    type="button"
                    onClick={() => navigate({ name: "project", slug: project.slug })}
                    className="truncate text-sm font-semibold text-foreground transition-colors hover:text-primary-700"
                  >
                    {project.title}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={project.status} />
                    {project.verified ? <VerifiedBadge withLabel /> : null}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Eye className="size-3" aria-hidden />
                      {formatViews(project.views)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Users className="size-3" aria-hidden />
                      {project.members.length} member{project.members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {project.supervisor ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Supervisor · {project.supervisor}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isLeader ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl px-3 text-xs font-semibold"
                      onClick={() => navigate({ name: "create", editSlug: project.slug })}
                    >
                      Edit project
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    className="h-9 rounded-xl px-3 text-xs font-semibold"
                    onClick={() => navigate({ name: "project", slug: project.slug })}
                  >
                    View page
                  </Button>
                </div>
              </article>

              {isLeader && pendingJoins !== null && pendingJoins > 0 ? (
                <button
                  type="button"
                  onClick={() => navigate({ name: "project", slug: project.slug })}
                  className="mt-2 flex w-full items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-left text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                >
                  <UsersRound className="size-4 shrink-0" aria-hidden />
                  {pendingJoins} pending join request{pendingJoins === 1 ? "" : "s"} - review on the
                  project page
                </button>
              ) : null}
            </div>
          )}
        </section>
      </FadeIn>

      <FadeIn className="min-w-0 space-y-4" delay={0.1}>
        <IdentityCard user={user} />
        <SecurityRow navigate={navigate} />
      </FadeIn>
    </div>
  );
}

// ============================================================
// PROFESSOR
// ============================================================

function ProfessorDashboard({ user, navigate }: { user: SafeUserDTO; navigate: Navigate }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <FadeIn delay={0.05}>
        <IdentityCard user={user} />
      </FadeIn>
      <FadeIn className="min-w-0 space-y-4" delay={0.1}>
        <ApprovalQueueCard onReview={(slug) => navigate({ name: "project", slug })} />
        <VerificationQueueCard onReview={(slug) => navigate({ name: "project", slug })} />
        <section
          aria-label="Teaching shortcuts"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-up-border bg-card p-4 shadow-card"
        >
          <Button
            variant="outline"
            className="gap-2 rounded-xl font-semibold"
            onClick={() => navigate({ name: "projects" })}
          >
            <FolderKanban className="size-4" aria-hidden />
            Browse projects
          </Button>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
            You can edit and verify the projects you supervise - verification requests from your
            sections land in the queue above.
          </p>
        </section>
      </FadeIn>
    </div>
  );
}

// ============================================================
// MODERATOR
// ============================================================

function ModeratorDashboard({ user, navigate }: { user: SafeUserDTO; navigate: Navigate }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <FadeIn className="min-w-0 space-y-4" delay={0.05}>
        <IdentityCard user={user} />
        <section aria-label="Shortcuts" className="rounded-2xl border border-up-border bg-card p-4 shadow-card">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Shortcuts</h2>
          <div className="mt-3 grid gap-2">
            <QuickLink
              icon={ShieldCheck}
              label="Open admin panel"
              hint="Users, projects and moderation"
              onClick={() => navigate({ name: "admin" })}
            />
            <QuickLink
              icon={FolderKanban}
              label="Browse projects"
              hint="The public showcase"
              onClick={() => navigate({ name: "projects" })}
            />
          </div>
        </section>
      </FadeIn>
      <FadeIn className="min-w-0 space-y-4" delay={0.1}>
        <VerificationQueueCard onReview={(slug) => navigate({ name: "project", slug })} />
        <ReportsQueueCard />
      </FadeIn>
    </div>
  );
}

// ---------- shared rows ----------

/** Subtle, always-on reminder that the coordinator generated the password. */
function SecurityRow({ navigate }: { navigate: Navigate }) {
  return (
    <button
      type="button"
      onClick={() => navigate({ name: "settings" })}
      className="group flex w-full items-start gap-3 rounded-2xl border border-dashed border-up-border bg-card/60 p-4 text-left outline-none transition-colors hover:border-up-border-strong hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground transition-colors group-hover:text-primary-700">
        <KeyRound className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Security
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-foreground">
          Your password was generated by the coordinator - change it in{" "}
          <span className="font-semibold text-primary-700 group-hover:underline">
            Account settings
          </span>
          .
        </span>
      </span>
    </button>
  );
}

function QuickLink({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof FolderKanban;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-xl border border-up-border bg-surface-muted/50 p-2.5 text-left outline-none transition-colors hover:border-up-border-strong hover:bg-primary-50/70 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-card text-primary-700 shadow-sm ring-1 ring-up-border">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary-700">
          {label}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}

// ============================================================
// View
// ============================================================

export function DashboardView({ navigate }: { navigate: Navigate }) {
  const user = useAppStore((s) => s.user);
  const openAuth = useAppStore((s) => s.openAuth);
  const authLoaded = useAppStore((s) => s.authLoaded);

  // guest gate (the header only surfaces this view when signed in, but ⌘K/links could too)
  if (authLoaded && !user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-20 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
          <Mail className="size-5" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-semibold text-foreground">Sign in to see your dashboard</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your projects, team status and account details live here. Students can request an account
          from the coordinator.
        </p>
        <Button onClick={() => openAuth("login")} className="mt-6 rounded-xl font-semibold">
          Sign in
        </Button>
      </div>
    );
  }

  if (!user) return null;

  const submitCta = canSubmit(user) ? (
    <Button
      onClick={() => navigate({ name: "create" })}
      className="h-10 gap-2 rounded-xl px-5 font-semibold"
    >
      <SquarePlus className="size-4" aria-hidden />
      Submit a project
    </Button>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 pb-20 md:px-8 md:py-14">
      <PageHeader user={user} right={submitCta} />
      <div className="mt-8">
        {user.role === "STUDENT" ? <StudentDashboard user={user} navigate={navigate} /> : null}
        {user.role === "PROFESSOR" ? <ProfessorDashboard user={user} navigate={navigate} /> : null}
        {user.role === "MODERATOR" ? <ModeratorDashboard user={user} navigate={navigate} /> : null}
        {user.role === "ADMIN" ? <AdminDashboard user={user} navigate={navigate} /> : null}
      </div>
    </div>
  );
}
