"use client";

// ============================================================
// HomeView — "The Campus Spotlight" landing page.
// Dark immersive hero + live search + parallax collage,
// project marquee, count-up stats, featured spotlight
// carousel, department cards, events, latest grid, CTA.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { animate, motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderKanban,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CATEGORIES, UNIVERSITY, accentOf } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  fetchDepartments,
  fetchEvents,
  fetchProjects,
  fetchStats,
  globalSearch,
  type DepartmentDTO,
  type EventDTO,
  type Navigate,
  type ProjectListItem,
  type SearchResults,
  type StatsDTO,
} from "../api-client";
import { useAppStore } from "../store";
import { ProjectCard } from "../project-card";
import { CategoryIcon, FeaturedBadge, SectionHeading, UserAvatar, VerifiedBadge, formatViews } from "../ui-bits";

const QUICK_CATEGORIES = ["AI & ML", "IoT & Hardware", "Web & App", "Data & Analytics"];
const HEADLINE_WORDS = ["project.", "idea.", "build.", "team."];

// ---------- tiny animation helpers ----------

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = Math.round(v).toLocaleString();
      },
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}

function RotatingWord() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HEADLINE_WORDS.length), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="relative inline-grid align-bottom">
      <span className="sr-only">{HEADLINE_WORDS[0]}</span>
      {HEADLINE_WORDS.map((w, i) => (
        <motion.span
          key={w}
          aria-hidden
          className="col-start-1 row-start-1 bg-gradient-to-r from-teal-300 via-teal-200 to-cyan-200 bg-clip-text text-transparent"
          initial={false}
          animate={
            i === idx
              ? { opacity: 1, y: 0, filter: "blur(0px)" }
              : { opacity: 0, y: 10, filter: "blur(4px)" }
          }
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          {w}
        </motion.span>
      ))}
    </span>
  );
}

// ---------- decorative backgrounds (shared by hero + CTA) ----------

function DarkBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-28 -top-32 size-96 rounded-full bg-teal-400/25 blur-3xl [animation:up-aurora_14s_ease-in-out_infinite]" />
      <div className="absolute -right-28 top-1/4 size-[26rem] rounded-full bg-teal-400/15 blur-3xl [animation:up-aurora_19s_ease-in-out_infinite_reverse]" />
      <div className="absolute bottom-[-6rem] left-1/3 size-80 rounded-full bg-sky-300/10 blur-3xl [animation:up-aurora_16s_ease-in-out_infinite]" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.13) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 85% 75% at 50% 32%, black 25%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 32%, black 25%, transparent 78%)",
        }}
      />
    </div>
  );
}

// ---------- hero search with instant results ----------

function HeroSearch({ navigate }: { navigate: Navigate }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const query = q.trim();
    const t = setTimeout(() => {
      if (query.length < 2) {
        setResults(null);
        setOpen(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      const seq = ++seqRef.current;
      globalSearch(query)
        .then((r) => {
          if (seq !== seqRef.current) return;
          setResults(r);
          setOpen(true);
        })
        .catch(() => {})
        .finally(() => {
          if (seq === seqRef.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const submit = () => {
    setOpen(false);
    navigate({ name: "projects", q: q.trim() || undefined });
  };

  const hasAny = results && (results.projects.length > 0 || results.users.length > 0);

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      {/* Bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-2 shadow-float backdrop-blur-md transition-colors focus-within:border-teal-300/60 focus-within:ring-2 focus-within:ring-teal-300/30">
        <Search className="ml-2.5 size-4.5 shrink-0 text-teal-200/70" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            if (results && q.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search projects, people, tags…"
          aria-label="Search the showcase"
          className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-teal-100/50"
        />
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-teal-200/70" aria-hidden /> : null}
        <Button
          onClick={submit}
          className="h-9 rounded-xl bg-teal-400 px-4 text-sm font-semibold text-teal-950 shadow-none hover:bg-teal-300"
        >
          Search
        </Button>
      </div>

      {/* Dropdown */}
      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-up-border bg-popover text-popover-foreground shadow-float">
          {!hasAny ? (
            <p className="px-5 py-6 text-center text-sm text-muted-foreground">
              No matches for <span className="font-semibold text-foreground">“{q.trim()}”</span>
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto nice-scroll">
              {results!.projects.length > 0 ? (
                <div className="p-2">
                  <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Projects
                  </p>
                  {results!.projects.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        navigate({ name: "project", slug: p.slug });
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-muted"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
                          accentOf(p.department.accent).cover
                        )}
                      >
                        <CategoryIcon category={p.category} className="size-4 text-foreground/60" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{p.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.category}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-up-border bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {p.department.code}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {results!.users.length > 0 ? (
                <div className="border-t border-up-border p-2">
                  <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    People
                  </p>
                  {results!.users.slice(0, 3).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        navigate({ name: "profile", username: u.username });
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-muted"
                    >
                      <UserAvatar name={u.displayName} avatarUrl={u.avatarUrl} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{u.displayName}</span>
                        <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                onClick={submit}
                className="flex w-full items-center justify-center gap-1.5 border-t border-up-border bg-surface-muted/60 px-4 py-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50"
              >
                See all results for “{q.trim()}”
                <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------- floating glass collage (hero right side) ----------

function CollageCard({
  project,
  onOpen,
  style,
  className,
}: {
  project: ProjectListItem;
  onOpen: (slug: string) => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  const accent = accentOf(project.department.accent);
  return (
    <button
      type="button"
      onClick={() => onOpen(project.slug)}
      style={style}
      className={cn(
        "group w-72 rounded-2xl border border-white/12 bg-white/[0.08] p-3 text-left shadow-float ring-1 ring-white/10 backdrop-blur-md transition-colors hover:border-teal-300/40",
        className
      )}
    >
      <span
        className={cn(
          "flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br",
          accent.cover
        )}
      >
        {project.coverImage ? (
          <img
            src={project.coverImage}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="size-full object-contain"
          />
        ) : null}
        {project.coverImage ? null : (
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/70 shadow-sm transition-transform duration-200 group-hover:scale-105">
            <CategoryIcon category={project.category} className="size-5 text-foreground/60" />
          </span>
        )}
      </span>
      <span className="mt-3 block truncate text-sm font-semibold text-white">{project.title}</span>
      <span className="mt-2 flex items-center justify-between">
        <span className={cn("rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-teal-100")}>
          {project.department.code}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-teal-100/70">
          <Eye className="size-3" aria-hidden />
          {formatViews(project.views)}
        </span>
      </span>
    </button>
  );
}

function FloatingCollage({
  projects,
  sx,
  sy,
  navigate,
}: {
  projects: ProjectListItem[] | null;
  sx: ReturnType<typeof useSpring>;
  sy: ReturnType<typeof useSpring>;
  navigate: Navigate;
}) {
  // Parallax depths (hooks must be unconditional)
  const x1 = useTransform(sx, (v) => v * -30);
  const y1 = useTransform(sy, (v) => v * -22);
  const x2 = useTransform(sx, (v) => v * 26);
  const y2 = useTransform(sy, (v) => v * 18);
  const x3 = useTransform(sx, (v) => v * -14);
  const y3 = useTransform(sy, (v) => v * 26);
  const xChip = useTransform(sx, (v) => v * 40);
  const yChip = useTransform(sy, (v) => v * -34);

  const items = projects?.slice(0, 3) ?? [];
  const students = items.flatMap((p) => p.members.slice(0, 2));

  return (
    <div className="relative mx-auto hidden h-[500px] w-full max-w-[560px] lg:block">
      {/* rings */}
      <div aria-hidden className="absolute left-1/2 top-1/2 size-[25rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-200/10" />
      <div aria-hidden className="absolute left-1/2 top-1/2 size-[33rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-teal-200/[0.06]" />

      {items.length === 0
        ? [0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "absolute h-60 w-72 animate-pulse rounded-2xl bg-white/[0.06]",
                i === 0 && "left-0 top-4 -rotate-6",
                i === 1 && "right-0 top-24 rotate-[5deg]",
                i === 2 && "bottom-2 left-[calc(50%-9rem)] rotate-1"
              )}
            />
          ))
        : null}

      {items[0] ? (
        <motion.div style={{ x: x1, y: y1 }} className="absolute left-0 top-4">
          <div className="[animation:up-float_7s_ease-in-out_infinite] -rotate-6">
            <CollageCard project={items[0]} onOpen={(slug) => navigate({ name: "project", slug })} />
          </div>
        </motion.div>
      ) : null}
      {items[1] ? (
        <motion.div style={{ x: x2, y: y2 }} className="absolute right-0 top-24">
          <div className="[animation:up-float_8s_ease-in-out_-2.5s_infinite] rotate-[5deg]">
            <CollageCard project={items[1]} onOpen={(slug) => navigate({ name: "project", slug })} />
          </div>
        </motion.div>
      ) : null}
      {items[2] ? (
        <motion.div style={{ x: x3, y: y3 }} className="absolute bottom-2 left-[calc(50%-9rem)]">
          <div className="[animation:up-float_9s_ease-in-out_-5s_infinite] rotate-1">
            <CollageCard project={items[2]} onOpen={(slug) => navigate({ name: "project", slug })} />
          </div>
        </motion.div>
      ) : null}

      {/* floating chips */}
      <motion.div style={{ x: xChip, y: yChip }} className="absolute right-4 top-2">
        <div className="[animation:up-float_6s_ease-in-out_-1s_infinite]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-100 shadow-float backdrop-blur-md">
            <Star className="size-3.5 fill-amber-300 text-amber-300" aria-hidden />
            Featured on campus
          </span>
        </div>
      </motion.div>
      <motion.div style={{ x: xChip, y: yChip }} className="absolute bottom-0 left-6">
        <div className="[animation:up-float_7.5s_ease-in-out_-4s_infinite]">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-100 shadow-float backdrop-blur-md">
            <span className="flex -space-x-1.5">
              {students.slice(0, 3).map((m) => (
                <UserAvatar key={m.id} name={m.name} avatarUrl={m.avatarUrl} className="size-5 text-[8px]" ring={false} />
              ))}
            </span>
            Student teams
          </span>
        </div>
      </motion.div>
    </div>
  );
}

// ---------- hero ----------

function Hero({
  navigate,
  stats,
  recent,
}: {
  navigate: Navigate;
  stats: StatsDTO | null;
  recent: ProjectListItem[] | null;
}) {
  const ref = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 55, damping: 16 });
  const sy = useSpring(my, { stiffness: 55, damping: 16 });

  const trustAvatars = recent?.flatMap((p) => p.members.slice(0, 1)).slice(0, 5) ?? [];

  return (
    <section
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        mx.set((e.clientX - rect.left) / rect.width - 0.5);
        my.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="relative overflow-hidden bg-night text-white"
    >
      <DarkBackdrop />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 pb-16 pt-12 md:px-8 md:pb-20 md:pt-16 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        {/* ---- left ---- */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] py-1.5 pl-3 pr-3.5 text-xs font-medium text-teal-100/90 backdrop-blur-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-teal-400" />
              </span>
              {UNIVERSITY.name} · {UNIVERSITY.tagline}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
            className="mt-6 text-[2.6rem] font-bold leading-[1.05] tracking-tight md:text-6xl"
          >
            One campus.
            <br />
            Every <RotatingWord />
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16, ease: "easeOut" }}
            className="mt-5 max-w-lg text-base leading-relaxed text-teal-100/70 md:text-lg"
          >
            {UNIVERSITY.description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24, ease: "easeOut" }}
            className="mt-8"
          >
            <HeroSearch navigate={navigate} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.32, ease: "easeOut" }}
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            {QUICK_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => navigate({ name: "projects", category: c })}
                className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-medium text-teal-100/80 transition-colors hover:border-teal-300/40 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/60"
              >
                {c}
              </button>
            ))}
          </motion.div>

          {/* trust row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="mt-8 flex items-center gap-3 text-sm text-teal-100/70"
          >
            <span className="flex -space-x-2">
              {trustAvatars.length > 0
                ? trustAvatars.map((m) => (
                    <UserAvatar key={m.id} name={m.name} avatarUrl={m.avatarUrl} className="size-7 ring-teal-950" />
                  ))
                : [0, 1, 2, 3].map((i) => (
                    <span key={i} className="size-7 animate-pulse rounded-full bg-white/10 ring-2 ring-night" />
                  ))}
            </span>
            <span>
              {stats ? (
                <>
                  <span className="font-semibold text-white">{stats.students} students</span> already showcasing across{" "}
                  {stats.departments} departments
                </>
              ) : (
                <span className="inline-block h-4 w-56 animate-pulse rounded bg-white/10" />
              )}
            </span>
          </motion.div>
        </div>

        {/* ---- right: parallax collage ---- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
        >
          <FloatingCollage projects={recent ?? null} sx={sx} sy={sy} navigate={navigate} />
        </motion.div>
      </div>

      {/* mobile collage strip */}
      <div className="relative lg:hidden">
        <div className="nice-scroll flex snap-x gap-3 overflow-x-auto px-5 pb-8">
          {(recent ?? []).slice(0, 5).map((p) => (
            <div key={p.id} className="shrink-0 snap-start">
              <CollageCard project={p} onOpen={(slug) => navigate({ name: "project", slug })} />
            </div>
          ))}
          {recent === null
            ? [0, 1, 2].map((i) => (
                <div key={i} className="h-60 w-72 shrink-0 animate-pulse rounded-2xl bg-white/[0.06]" />
              ))
            : null}
        </div>
      </div>
    </section>
  );
}

// ---------- marquee ticker ----------

function Marquee({ projects }: { projects: ProjectListItem[] | null }) {
  if (!projects || projects.length === 0) {
    return (
      <div className="border-b border-up-border bg-white py-4">
        <div className="mx-auto max-w-6xl px-5">
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-surface-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border-b border-up-border bg-white py-3.5" aria-label="Latest project titles">
      <div className="flex w-max [animation:up-marquee_45s_linear_infinite] hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1} className="flex items-center gap-10 pr-10">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 whitespace-nowrap text-sm">
                <Sparkles className="size-3.5 text-primary-500" aria-hidden />
                <span className="font-medium text-foreground">{p.title}</span>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  {p.department.code}
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
      {/* soft white fades so titles dissolve at the edges instead of hard-clipping */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white via-white/60 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white via-white/60 to-transparent" />
    </div>
  );
}

// ---------- count-up stats ----------

function StatsBand({ stats }: { stats: StatsDTO | null }) {
  const cells = [
    { icon: FolderKanban, label: "Projects", value: stats?.projects },
    { icon: Users, label: "Students involved", value: stats?.students },
    { icon: Building2, label: "Departments", value: stats?.departments },
    { icon: BadgeCheck, label: "Faculty verified", value: stats?.verified },
  ];

  return (
    <section aria-label="Showcase statistics" className="mx-auto mt-12 w-full max-w-6xl px-5 md:mt-14 md:px-8">
      <Reveal>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-up-border bg-up-border shadow-sm lg:grid-cols-4">
          {cells.map((c) => (
            <div key={c.label} className="flex items-center gap-4 bg-card px-5 py-5 md:px-7">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600">
                <c.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                {c.value === undefined ? (
                  <span className="block h-7 w-12 animate-pulse rounded bg-surface-muted" />
                ) : (
                  <CountUp value={c.value} className="block text-2xl font-bold tabular-nums tracking-tight text-foreground md:text-[1.7rem]" />
                )}
                <p className="mt-0.5 text-[11px] font-medium uppercase leading-snug tracking-wide text-muted-foreground">
                  {c.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

// ---------- featured spotlight carousel ----------

function Spotlight({ navigate, projects }: { navigate: Navigate; projects: ProjectListItem[] | null }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = projects?.length ?? 0;

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || paused || count < 2) return;
    const t = setInterval(() => emblaApi.scrollNext(), 6000);
    return () => clearInterval(t);
  }, [emblaApi, paused, count]);

  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-24 md:px-8">
      <div className="flex items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Editor's picks"
          title="Featured spotlight"
          description="Hand-picked builds that define this year on campus."
        />
        {count > 1 ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label="Previous featured project"
              onClick={() => emblaApi?.scrollPrev()}
              className="flex size-9 items-center justify-center rounded-full border border-up-border bg-card text-foreground shadow-sm transition-colors hover:border-up-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next featured project"
              onClick={() => emblaApi?.scrollNext()}
              className="flex size-9 items-center justify-center rounded-full border border-up-border bg-card text-foreground shadow-sm transition-colors hover:border-up-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      <Reveal className="mt-6">
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {projects === null ? (
            <div className="h-72 animate-pulse rounded-3xl border border-up-border bg-surface-muted md:h-80" />
          ) : count === 0 ? null : (
            <>
              <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex">
                  {projects.map((p) => {
                    const accent = accentOf(p.department.accent);
                    return (
                      <div key={p.id} className="min-w-0 flex-[0_0_100%] pl-0 first:pl-0 sm:pl-0 md:flex-[0_0_88%]">
                        <article className="group mr-0 grid overflow-hidden rounded-3xl border border-up-border bg-card shadow-card md:mr-5 md:grid-cols-[0.85fr_1.15fr]">
                          <div
                            className={cn(
                              "relative flex min-h-44 items-center justify-center overflow-hidden bg-gradient-to-br md:min-h-[290px]",
                              accent.cover
                            )}
                          >
                            {p.coverImage ? (
                              <img
                                src={p.coverImage}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                                className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            ) : null}
                            {p.coverImage ? null : (
                              <span className="flex size-16 items-center justify-center rounded-2xl bg-white/70 text-foreground/60 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                                <CategoryIcon category={p.category} className="size-7" />
                              </span>
                            )}
                            {p.featured ? (
                              <span className="absolute left-4 top-4">
                                <FeaturedBadge />
                              </span>
                            ) : null}
                            <span className="absolute right-4 top-4 flex items-center gap-1.5">
                              {p.verified ? <VerifiedBadge /> : null}
                              <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm", p.coverImage ? "bg-white/90" : "bg-white/85", accent.chip)}>
                                {p.department.code}
                              </span>
                            </span>
                          </div>
                          <div className="flex flex-col p-6 md:p-8">
                            <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">
                              {p.category} · {p.year} {p.semester}
                            </p>
                            <h3 className="mt-2 line-clamp-1 text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary-700 md:text-2xl">
                              {p.title}
                            </h3>
                            <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                              {p.summary}
                            </p>
                            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                              <div className="flex items-center gap-2.5">
                                <div className="flex -space-x-2">
                                  {p.members.slice(0, 4).map((m) => (
                                    <UserAvatar key={m.id} name={m.name} avatarUrl={m.avatarUrl} />
                                  ))}
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {p.members.length} {p.members.length === 1 ? "member" : "members"}
                                </span>
                              </div>
                              <Button
                                onClick={() => navigate({ name: "project", slug: p.slug })}
                                className="h-9 rounded-xl px-4 text-sm font-semibold"
                              >
                                View project
                                <ArrowUpRight className="size-4" aria-hidden />
                              </Button>
                            </div>
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
              </div>

              {count > 1 ? (
                <div className="mt-5 flex items-center justify-center gap-1.5">
                  {projects.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-label={`Go to featured project ${i + 1}: ${p.title}`}
                      onClick={() => emblaApi?.scrollTo(i)}
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        i === selected ? "w-8 bg-primary" : "w-2 bg-up-border-strong hover:bg-muted-foreground/40"
                      )}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
}

// ---------- departments ----------

function Departments({ navigate, departments }: { navigate: Navigate; departments: DepartmentDTO[] | null }) {
  if (departments !== null && departments.length === 0) return null;

  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-24 md:px-8">
      <SectionHeading
        eyebrow="Browse by department"
        title="Six departments, one showcase"
        description="Every project belongs to a department — jump straight into the one you care about."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments === null
          ? [0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-up-border bg-surface-muted" />
            ))
          : departments.map((d, i) => {
              const accent = accentOf(d.accent);
              return (
                <Reveal key={d.id} delay={Math.min(i * 0.05, 0.3)}>
                  <button
                    type="button"
                    onClick={() => navigate({ name: "projects", dept: d.code })}
                    className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-up-border bg-card p-5 text-left outline-none transition-all duration-300 hover:-translate-y-0.5 hover:border-up-border-strong hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* No more bottom accent bar — instead the accent floods the whole card:
                        a circle of the department color swallows it from the bottom-left corner
                        and every line of text flips to white while it's flooded. */}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -bottom-20 -left-14 size-64 origin-center scale-0 rounded-full transition-transform duration-300 ease-out group-hover:scale-[3]",
                        accent.dot,
                      )}
                    />
                    <div className="relative z-10 flex h-full w-full flex-col">
                      <div className="flex items-start justify-between">
                        <span
                          className={cn(
                            "flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-foreground/70 transition-transform duration-300 group-hover:scale-110",
                            accent.cover,
                          )}
                        >
                          {d.code.slice(0, 2)}
                        </span>
                        <ArrowUpRight
                          className="size-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white group-hover:opacity-100"
                          aria-hidden
                        />
                      </div>
                      <h3 className="mt-3.5 font-semibold tracking-tight text-foreground transition-colors duration-300 group-hover:text-white">
                        {d.name}
                      </h3>
                      {d.tagline ? (
                        <p className="mt-1 text-sm text-muted-foreground transition-colors duration-300 group-hover:text-white/85">
                          {d.tagline}
                        </p>
                      ) : null}
                      <p className="mt-auto pt-3.5 text-xs font-medium text-muted-foreground transition-colors duration-300 group-hover:text-white/80">
                        {d.projectCount} {d.projectCount === 1 ? "project" : "projects"}
                      </p>
                    </div>
                  </button>
                </Reveal>
              );
            })}
      </div>
    </section>
  );
}

// ---------- events ----------

function EventCard({ event, next }: { event: EventDTO; next?: boolean }) {
  const d = new Date(event.date);
  const countdown = formatDistanceToNowStrict(d, { addSuffix: true });

  return (
    <article className="relative flex h-full items-start gap-4 rounded-2xl border border-up-border bg-card p-5 shadow-sm card-hover">
      {next ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
          Next up
        </span>
      ) : null}
      <span className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 text-primary-700 ring-1 ring-inset ring-primary-100">
        <span className="text-[10px] font-bold uppercase tracking-wide">{format(d, "MMM")}</span>
        <span className="text-2xl font-bold leading-none">{format(d, "d")}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold tracking-tight text-foreground">{event.title}</h3>
          <span className="mt-0.5 shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {countdown}
          </span>
        </div>
        <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-primary-700">
          <CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {format(d, "EEEE, MMM d, yyyy")}
            <span aria-hidden> · </span>
            {format(d, "h:mm a")}
          </span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{event.description}</p>
        {event.location ? (
          <p className="mt-auto flex items-start gap-1.5 pt-3 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{event.location}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Events({ events }: { events: EventDTO[] | null }) {
  if (events !== null && events.length === 0) return null;

  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-24 md:px-8">
      <SectionHeading
        eyebrow="On campus"
        title="What's coming up"
        description="Demo days, critique sessions, and showcases worth marking in your calendar."
      />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events === null
          ? [0, 1, 2].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-2xl border border-up-border bg-surface-muted" />
            ))
          : events.map((ev, i) => (
              <Reveal key={ev.id} delay={Math.min(i * 0.06, 0.24)} className="h-full">
                <EventCard event={ev} next={i === 0} />
              </Reveal>
            ))}
      </div>
    </section>
  );
}

// ---------- latest grid ----------

function Latest({ navigate, recent }: { navigate: Navigate; recent: ProjectListItem[] | null }) {
  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-5 md:mt-24 md:px-8">
      <div className="flex items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Fresh from the labs"
          title="Latest submissions"
          description="The most recent projects added to the showcase."
        />
        <Button
          variant="ghost"
          onClick={() => navigate({ name: "projects" })}
          className="hidden shrink-0 text-primary-700 hover:text-primary-600 sm:inline-flex"
        >
          View all
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="mt-6">
        {recent === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-up-border bg-surface-muted" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-up-border-strong bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            No projects yet — be the first to submit one.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.slice(0, 6).map((p, i) => (
              <Reveal key={p.id} delay={Math.min(i * 0.06, 0.3)}>
                <ProjectCard project={p} onOpen={(slug) => navigate({ name: "project", slug })} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
      <div className="mt-8 text-center sm:hidden">
        <Button variant="outline" className="h-11 rounded-xl px-6 font-semibold" onClick={() => navigate({ name: "projects" })}>
          Browse all projects
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}

// ---------- CTA ----------

function CtaPanel({ navigate }: { navigate: Navigate }) {
  const submit = () => {
    const { user, openAuth } = useAppStore.getState();
    if (!user) {
      toast.info("Sign in to submit a project");
      openAuth("login");
      return;
    }
    navigate({ name: "create" });
  };

  return (
    <section className="mx-auto mt-16 w-full max-w-6xl px-5 pb-20 md:mt-24 md:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-night px-6 py-14 text-center text-white md:px-12 md:py-20">
          <DarkBackdrop />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-xs font-medium text-teal-100/90 backdrop-blur-sm">
              <Sparkles className="size-3.5 text-teal-300" aria-hidden />
              Join the showcase
            </span>
            <h2 className="mx-auto mt-5 max-w-xl text-2xl font-bold tracking-tight md:text-4xl">
              Built something worth showing?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-teal-100/70 md:text-base">
              Put your project in front of the whole campus — professors, recruiters, and future teammates included.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={submit}
                className="h-11 rounded-xl bg-teal-400 px-6 font-semibold text-teal-950 shadow-float hover:bg-teal-300"
              >
                Submit your project
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ name: "projects" })}
                className="h-11 rounded-xl border-white/20 bg-white/[0.04] px-6 font-semibold text-white hover:bg-white/10 hover:text-white"
              >
                Browse projects
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ---------- root ----------

export function HomeView({ navigate }: { navigate: Navigate }) {
  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [featured, setFeatured] = useState<ProjectListItem[] | null>(null);
  const [recent, setRecent] = useState<ProjectListItem[] | null>(null);
  const [departments, setDepartments] = useState<DepartmentDTO[] | null>(null);
  const [events, setEvents] = useState<EventDTO[] | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchStats(ac.signal)
      .then(setStats)
      .catch(() => {});
    fetchDepartments(ac.signal)
      .then(setDepartments)
      .catch(() => {});
    fetchEvents(ac.signal)
      .then(setEvents)
      .catch(() => {});
    fetchProjects({ featured: "1", limit: 5 }, ac.signal)
      .then(setFeatured)
      .catch(() => {});
    fetchProjects({ sort: "newest", limit: 6 }, ac.signal)
      .then(setRecent)
      .catch(() => {});
    return () => ac.abort();
  }, []);

  return (
    <div>
      <Hero navigate={navigate} stats={stats} recent={recent} />
      <Marquee projects={recent} />
      <StatsBand stats={stats} />
      <Spotlight navigate={navigate} projects={featured} />
      <Departments navigate={navigate} departments={departments} />
      <Events events={events} />
      <Latest navigate={navigate} recent={recent} />
      <CtaPanel navigate={navigate} />
    </div>
  );
}

