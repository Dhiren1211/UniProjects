"use client";

// ============================================================
// Footer — "The Campus Spotlight" closing chapter.
// Dark grounding block (matches the hero + CTA panel), KS
// branding, staggered reveals, micro-interactions, back-to-top.
// ============================================================

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, ArrowUpRight, MapPin } from "lucide-react";
import { UNIVERSITY } from "@/lib/config";
import { requireAuth, useAppStore } from "./store";
import type { Navigate } from "./api-client";

// ---------- tiny reveal helper (reduced-motion aware) ----------

function FadeIn({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------- link row pieces ----------

const linkCls =
  "group inline-flex items-center gap-1.5 rounded text-sm text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/60";

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-100/60">
      {children}
    </p>
  );
}

// ---------- footer ----------

export function Footer({ navigate }: { navigate: Navigate }) {
  const user = useAppStore((s) => s.user);
  const reduceMotion = useReducedMotion();

  const submit = () => {
    const { user: current, openAuth } = useAppStore.getState();
    if (!requireAuth(current, openAuth)) return;
    navigate({ name: "create" });
  };

  const backToTop = () =>
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });

  const explore = [
    { label: "Overview", go: () => navigate({ name: "home" }) },
    { label: "All projects", go: () => navigate({ name: "projects" }) },
    { label: "Community board", go: () => navigate({ name: "community" }) },
    { label: "Student directory", go: () => navigate({ name: "students" }) },
  ];

  const participate = user
    ? [
        { label: "Submit a project", go: submit },
        { label: "My showcase", go: () => navigate({ name: "profile", username: user.username }) },
        { label: "Account settings", go: () => navigate({ name: "settings" }) },
        { label: "Notifications", go: () => navigate({ name: "notifications" }) },
      ]
    : [
        { label: "Submit a project", go: submit },
        { label: "Sign in", go: () => useAppStore.getState().openAuth("login") },
        { label: "Create account", go: () => useAppStore.getState().openAuth("register") },
      ];

  const university = [
    { label: "University website", href: "https://www.ks.ac.kr" },
    { label: "Student portal (kscms)", href: "https://kscms.ks.ac.kr" },
    {
      label: "Campus location map",
      href: "https://maps.google.com/?q=Kyungsung+University+Busan",
    },
  ];

  return (
    <footer className="relative mt-auto overflow-hidden bg-night text-white">
      {/* top hairline + ambient backdrop (same language as the hero) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 size-80 rounded-full bg-teal-400/10 blur-3xl [animation:up-aurora_18s_ease-in-out_infinite]" />
        <div className="absolute -right-20 bottom-10 size-72 rounded-full bg-sky-400/[0.07] blur-3xl [animation:up-aurora_23s_ease-in-out_infinite_reverse]" />
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse 80% 70% at 50% 0%, black 20%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 70% at 50% 0%, black 20%, transparent 75%)",
          }}
        />
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-14 md:px-8 md:pt-20 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_2fr] lg:gap-16">
          {/* Brand */}
          <FadeIn>
            <div className="max-w-sm">
              <div className="flex items-center gap-3">
                <img
                  src={UNIVERSITY.logoWhite}
                  alt="Kyungsung University"
                  className="h-9 w-auto"
                />
                <span className="hidden h-5 w-px bg-white/15 sm:block" aria-hidden />
                <span className="hidden flex-col items-start leading-none sm:flex">
                  <span className="text-[13px] font-semibold tracking-tight text-white">
                    Project Showcase
                  </span>
                  <span className="mt-0.5 text-[11px] font-medium text-white/50">
                    {UNIVERSITY.koreanName}
                  </span>
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                {UNIVERSITY.description}
              </p>
              <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-white/45">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-teal-300/80" aria-hidden />
                {UNIVERSITY.location}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/55">
                  Est. {UNIVERSITY.founded}
                </span>
                <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/55">
                  Daeyeon-dong · Busan
                </span>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-white/45">
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-teal-300" />
                </span>
                Showcase updated every semester
              </p>
            </div>
          </FadeIn>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
            <FadeIn delay={0.05}>
              <nav aria-label="Explore">
                <ColumnHeading>Explore</ColumnHeading>
                <ul className="mt-4 space-y-2.5">
                  {explore.map((item) => (
                    <li key={item.label}>
                      <button type="button" onClick={item.go} className={linkCls}>
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </FadeIn>

            <FadeIn delay={0.1}>
              <nav aria-label="Participate">
                <ColumnHeading>Participate</ColumnHeading>
                <ul className="mt-4 space-y-2.5">
                  {participate.map((item) => (
                    <li key={item.label}>
                      <button type="button" onClick={item.go} className={linkCls}>
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </FadeIn>

            <FadeIn delay={0.15}>
              <nav aria-label="University links">
                <ColumnHeading>University</ColumnHeading>
                <ul className="mt-4 space-y-2.5">
                  {university.map((item) => (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={linkCls}
                      >
                        {item.label}
                        <ArrowUpRight
                          className="size-3 -translate-x-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                          aria-hidden
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </FadeIn>
          </div>
        </div>

        {/* Bottom bar */}
        <FadeIn y={10}>
          <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 pb-2 md:mt-16 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-white/45">
              © {new Date().getFullYear()} {UNIVERSITY.name} · Project Showcase
            </p>
            <div className="flex items-center gap-4">
              <p className="text-xs italic text-white/40">“{UNIVERSITY.motto}”</p>
              <motion.button
                type="button"
                onClick={backToTop}
                whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                aria-label="Back to top"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/60"
              >
                <ArrowUp className="size-4" aria-hidden />
              </motion.button>
            </div>
          </div>
        </FadeIn>
      </div>
    </footer>
  );
}
