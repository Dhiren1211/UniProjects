"use client";

// ============================================================
// Shared dashboard building blocks - the reveal helper, page
// header and the identity card every role's layout reuses.
// ============================================================

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Users } from "lucide-react";
import { RoleBadge, UserAvatar } from "../ui-bits";
import type { SafeUserDTO } from "@/lib/types";

/** Tiny reveal helper (reduced-motion aware). */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({ user, right }: { user: SafeUserDTO; right?: ReactNode }) {
  const firstName = user.displayName.split(" ")[0];
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">Dashboard</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Welcome back, {firstName}
          <RoleBadge role={user.role} />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.department ? `${user.department.name} · ` : ""}@{user.username}
        </p>
      </div>
      {right}
    </header>
  );
}

function labelForCapstone(
  capstone: string | null,
  capstoneLabel = "Capstone Design"
): string | null {
  if (!capstone) return null;
  if (capstone === "I" || capstone === "II" || capstone === "III") return `${capstoneLabel} ${capstone}`;
  return capstone;
}

/** Avatar + role-specific account facts, shared by every role's layout. */
export function IdentityCard({ user }: { user: SafeUserDTO }) {
  // the faculty's own capstone term (Global IT's "Capstone Design" is the default)
  const capstone = labelForCapstone(user.capstone, user.department?.capstoneLabel);
  return (
    <section
      aria-label="Account overview"
      className="rounded-2xl border border-up-border bg-card p-5 shadow-card"
    >
      <div className="flex items-center gap-3">
        <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} className="size-12 text-sm" ring={false} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-foreground">{user.displayName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            @{user.username}
            {user.role === "STUDENT" ? (
              user.isTeamLeader ? (
                <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                  Team Leader
                </span>
              ) : (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Member
                </span>
              )
            ) : null}
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2.5 border-t border-up-border pt-4 text-sm">
        {user.studentId ? (
          <li className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Student ID</span>
            <span className="font-medium tabular-nums text-foreground">{user.studentId}</span>
          </li>
        ) : null}
        {user.classId ? (
          <li className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Section</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
              <Users className="size-3.5 text-primary-700" aria-hidden />
              {user.classId}
            </span>
          </li>
        ) : null}
        {capstone || user.cohortYear ? (
          <li className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Course</span>
            <span className="font-medium text-foreground">
              {[capstone, user.cohortYear ? `${user.cohortYear} cohort` : null].filter(Boolean).join(" · ")}
            </span>
          </li>
        ) : null}
        {user.professorName ? (
          <li className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Professor</span>
            <span className="min-w-0 truncate font-medium text-foreground">{user.professorName}</span>
          </li>
        ) : null}
        {user.department ? (
          <li className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-muted-foreground">Department</span>
            <span className="min-w-0 truncate font-medium text-foreground">{user.department.name}</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
