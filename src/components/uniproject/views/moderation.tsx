"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Flag,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  decideVerification,
  fetchReports,
  fetchVerifications,
  resolveReport,
  type Navigate,
  type ReportDTO,
  type VerificationDTO,
} from "../api-client";
import { useAppStore } from "../store";
import { EmptyState, timeAgo } from "../ui-bits";

export function ModerationView({ navigate }: { navigate: Navigate }) {
  const { user, authLoaded, openAuth } = useAppStore();
  const [verifications, setVerifications] = useState<VerificationDTO[] | null>(null); // null = loading
  const [reports, setReports] = useState<ReportDTO[] | null>(null); // null = loading
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const isStaff = user?.role === "FACULTY" || user?.role === "ADMIN";

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    fetchVerifications()
      .then((rows) => {
        if (cancelled) return;
        setVerifications(rows);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setVerifications([]);
        setError(true);
      });
    fetchReports()
      .then((rows) => {
        if (cancelled) return;
        setReports(rows);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setReports([]);
        setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isStaff, retry]);

  // ---------- gates ----------

  if (!authLoaded) {
    return (
      <Page>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </Page>
    );
  }

  if (!user || !isStaff) {
    return (
      <Page>
        <EmptyState
          icon={user ? ShieldAlert : Lock}
          title="Staff only"
          hint="Moderation tools are limited to faculty and administrators."
          action={
            !user ? (
              <Button onClick={() => openAuth("login")} className="rounded-xl font-semibold">
                Sign in
              </Button>
            ) : undefined
          }
        />
      </Page>
    );
  }

  const loading = verifications === null || reports === null;
  const openReports = reports?.filter((r) => r.status !== "RESOLVED") ?? [];
  const resolvedReports = reports?.filter((r) => r.status === "RESOLVED") ?? [];

  // ---------- actions ----------

  const decide = async (v: VerificationDTO, decision: "APPROVED" | "REJECTED") => {
    if (busy) return;
    setBusy(`v:${v.id}`);
    try {
      await decideVerification({ verificationId: v.id, decision });
      setVerifications((prev) => (prev ? prev.filter((x) => x.id !== v.id) : prev));
      toast.success(
        decision === "APPROVED"
          ? `Verified “${v.project.title}”`
          : `Rejected the verification request for “${v.project.title}”`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the decision");
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (r: ReportDTO) => {
    if (busy) return;
    setBusy(`r:${r.id}`);
    try {
      await resolveReport(r.id);
      setReports((prev) =>
        prev ? prev.map((x) => (x.id === r.id ? { ...x, status: "RESOLVED" } : x)) : prev
      );
      toast.success("Report resolved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resolve the report");
    } finally {
      setBusy(null);
    }
  };

  const tryAgain = () => {
    setVerifications(null);
    setReports(null);
    setError(false);
    setRetry((n) => n + 1);
  };

  return (
    <Page>
      {/* Heading */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Moderation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Verify faculty-sponsored projects and keep the showcase safe.
        </p>
        <p className="mt-3 rounded-xl bg-surface-muted px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Staff tools.</span> Approving a
          verification marks the project as faculty-verified; resolving a report closes it for
          review. This demo applies decisions to the seeded campus data.
        </p>
      </header>

      {error && !loading ? (
        <div className="mt-8">
          <EmptyState
            icon={AlertTriangle}
            title="Something went wrong"
            hint="We couldn't load the moderation queues. Check your connection and try again."
            action={
              <Button onClick={tryAgain} variant="outline" className="rounded-xl font-semibold">
                Try again
              </Button>
            }
          />
        </div>
      ) : loading ? (
        <div className="mt-8 space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-6 w-56" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* ---------- Verification requests ---------- */}
          <section className="mt-10">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                Verification requests
              </h2>
              <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
                {verifications?.length ?? 0}
              </span>
            </div>

            {verifications && verifications.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={BadgeCheck}
                  title="No pending verifications"
                  hint="When students request faculty verification, the queue appears here."
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {verifications?.map((v) => (
                  <article
                    key={v.id}
                    className="flex flex-col rounded-2xl border border-up-border bg-card p-5 shadow-card"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                        <ShieldCheck className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => navigate({ name: "project", slug: v.project.slug })}
                          className="block max-w-full truncate text-left font-semibold text-foreground transition-colors hover:text-primary-700"
                        >
                          {v.project.title}
                        </button>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Requested by {v.requester.displayName} (@{v.requester.username}) ·{" "}
                          {timeAgo(v.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t border-up-border pt-4">
                      <Button
                        onClick={() => decide(v, "APPROVED")}
                        disabled={busy !== null}
                        className="h-9 flex-1 rounded-xl font-semibold"
                      >
                        {busy === `v:${v.id}` ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <ShieldCheck className="size-4" aria-hidden />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => decide(v, "REJECTED")}
                        disabled={busy !== null}
                        className="h-9 flex-1 rounded-xl font-semibold"
                      >
                        <X className="size-4" aria-hidden />
                        Reject
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ---------- Reports ---------- */}
          <section className="mt-12">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Reports</h2>
              <span className="rounded-full bg-danger-soft px-2.5 py-1 text-[11px] font-semibold text-danger">
                {openReports.length}
              </span>
            </div>

            {openReports.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={ShieldCheck}
                  title="No open reports"
                  hint="Flagged projects, posts, and users will appear here for review."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {openReports.map((r) => (
                  <article
                    key={r.id}
                    className="rounded-2xl border border-up-border bg-card p-5 shadow-card"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {r.targetSlug ? (
                        <button
                          type="button"
                          onClick={() => navigate({ name: "project", slug: r.targetSlug! })}
                          className="font-semibold text-foreground transition-colors hover:text-primary-700"
                        >
                          {r.targetLabel}
                        </button>
                      ) : (
                        <span className="font-semibold text-foreground">{r.targetLabel}</span>
                      )}
                      <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {r.targetType}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {timeAgo(r.createdAt)}
                      </span>
                    </div>
                    <blockquote className="mt-3 border-l-2 border-up-border-strong pl-3 text-sm leading-relaxed text-muted-foreground">
                      “{r.reason}”
                    </blockquote>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-up-border pt-4">
                      <p className="text-xs text-muted-foreground">
                        Reported by {r.reporter.displayName} (@{r.reporter.username})
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => resolve(r)}
                        disabled={busy !== null}
                        className="h-9 rounded-xl px-4 font-semibold"
                      >
                        {busy === `r:${r.id}` ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Flag className="size-4" aria-hidden />
                        )}
                        Mark resolved
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Resolved reports — dimmed archive */}
            {resolvedReports.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Resolved · {resolvedReports.length}
                </h3>
                <ul className="mt-3 space-y-2">
                  {resolvedReports.map((r) => (
                    <li
                      key={r.id}
                      className={cn(
                        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-up-border bg-card px-4 py-3 text-sm opacity-60"
                      )}
                    >
                      <BadgeCheck className="size-4 shrink-0 text-success" aria-hidden />
                      <span className="font-medium text-foreground">{r.targetLabel}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.targetType} · reported by @{r.reporter.username} · {timeAgo(r.createdAt)}
                      </span>
                      <span className="ml-auto rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success">
                        Resolved
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </>
      )}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 pb-20 md:px-8 md:py-14">{children}</div>
  );
}
