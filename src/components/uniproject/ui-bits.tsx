// Small shared UI pieces for UniProjects

import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Cpu,
  Palette,
  SearchX,
  ShieldCheck,
  Star,
  Users,
  X,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { accentOf } from "@/lib/config";
import { cn } from "@/lib/utils";

// ---------- formatting ----------

export function formatViews(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function formatMonthYear(iso: string) {
  try {
    return format(new Date(iso), "MMM yyyy");
  } catch {
    return "";
  }
}

export function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

// ---------- badges ----------

export function VerifiedBadge({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-semibold text-success"
      title="Verified by faculty"
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      {withLabel ? "Verified" : <span className="sr-only">Verified</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const isDraft = status === "DRAFT";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        isDraft ? "bg-warning-soft text-warning" : "bg-surface-muted text-muted-foreground"
      )}
    >
      {isDraft ? <CircleDashed className="size-3.5" aria-hidden /> : null}
      {isDraft ? "Draft" : "Published"}
    </span>
  );
}

export function TeammateWantedChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700">
      <Users className="size-3.5" aria-hidden />
      Open to teammates
    </span>
  );
}

export function FeaturedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-primary-700 shadow-sm">
      <Star className="size-3 fill-current" aria-hidden />
      Featured
    </span>
  );
}

export function StaffBadge({ role }: { role: string }) {
  if (role !== "FACULTY" && role !== "ADMIN") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-[10px] font-semibold text-info">
      <ShieldCheck className="size-3" aria-hidden />
      {role === "ADMIN" ? "Admin" : "Faculty"}
    </span>
  );
}

// ---------- category icons ----------

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  BrainCircuit: BrainCircuit,
  AppWindow: AppWindow,
  Cpu: Cpu,
  BarChart3: BarChart3,
  Palette: Palette,
  ShieldCheck: ShieldCheck,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const map: Record<string, string> = {
    "AI & ML": "BrainCircuit",
    "Web & App": "AppWindow",
    "IoT & Hardware": "Cpu",
    "Data & Analytics": "BarChart3",
    "Design & Media": "Palette",
    Security: "ShieldCheck",
  };
  const Icon = CATEGORY_ICON_MAP[map[category] ?? "AppWindow"] ?? AppWindow;
  return <Icon className={className} aria-hidden />;
}

// ---------- avatars ----------

const AVATAR_STYLES = [
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-lime-100 text-lime-700",
];

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MemberAvatar({
  name,
  className,
  ring = true,
}: {
  name: string;
  className?: string;
  ring?: boolean;
}) {
  const idx =
    Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % AVATAR_STYLES.length;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
        AVATAR_STYLES[idx],
        ring && "ring-2 ring-white",
        className
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * Real user avatar: shows the user's profile picture when they have one,
 * falls back to the deterministic initials avatar otherwise.
 */
export function UserAvatar({
  name,
  avatarUrl,
  className,
  ring = true,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (avatarUrl && !failed) {
    return (
      <img
        src={avatarUrl}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn(
          "size-8 shrink-0 rounded-full object-cover",
          ring && "ring-2 ring-white",
          className
        )}
      />
    );
  }
  return <MemberAvatar name={name} className={className} ring={ring} />;
}

// ---------- section heading ----------

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

// ---------- misc ----------

export function DeptDot({ accent, className }: { accent: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 rounded-full", accentOf(accent).dot, className)} />;
}

export function EmptyState({
  icon: Icon = SearchX,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-up-border-strong bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-4 font-semibold text-foreground">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-up-border bg-card">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------- lightbox ----------

/**
 * Full-screen image viewer. The image is always shown whole — natural aspect
 * ratio, letterboxed on a dark blurred backdrop, never cropped or stretched.
 * Optional prev/next handlers enable gallery navigation (arrow keys too).
 */
export function Lightbox({
  src,
  alt,
  onClose,
  onPrev,
  onNext,
}: {
  src: string;
  alt: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onPrev, onNext]);

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-night/90 p-4 backdrop-blur-sm"
    >
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-full rounded-xl object-contain shadow-float"
      />

      <button
        type="button"
        aria-label="Close image view"
        onClick={onClose}
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="size-5" aria-hidden />
      </button>

      {onPrev ? (
        <button
          type="button"
          aria-label="Previous image"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      ) : null}
      {onNext ? (
        <button
          type="button"
          aria-label="Next image"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      ) : null}
    </motion.div>
  );
}
