"use client";

// ============================================================
// Admin → Storage
//   1. Database capacity: used / free with a per-category breakdown
//   2. Image compression for new uploads
//   3. One-click compression of images uploaded earlier
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Database, ImageDown, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  compressExistingImages,
  fetchStorageReport,
  updateStorageConfig,
  type StorageConfigDTO,
  type StorageReportDTO,
} from "./api-client";

/** One colour per category, in display order. */
const COLORS: Record<string, string> = {
  projectImages: "bg-blue-600",
  projectFiles: "bg-violet-500",
  avatars: "bg-pink-500",
  siteImages: "bg-amber-500",
  content: "bg-emerald-500",
  accounts: "bg-sky-400",
  logs: "bg-orange-400",
  system: "bg-slate-400",
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
}

function pct(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function Card({ title, caption, icon: Icon, right, children }: {
  title: string;
  caption: string;
  icon: typeof Database;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-up-border bg-card p-4 shadow-card md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function StorageTab({
  refreshTick,
  onLoaded,
}: {
  refreshTick: number;
  onLoaded: (ok: boolean) => void;
}) {
  const [report, setReport] = useState<StorageReportDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) =>
      fetchStorageReport(signal)
        .then((r) => {
          setReport(r);
          setError(null);
          onLoaded(true);
        })
        .catch((e) => {
          if (signal?.aborted) return;
          setError(e instanceof Error ? e.message : "Could not measure storage");
          onLoaded(false);
        }),
    [onLoaded]
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load, refreshTick]);

  if (error && !report) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger-soft/40 p-5 text-sm text-danger">
        {error}
        <Button variant="outline" size="sm" className="ml-3 rounded-lg" onClick={() => load()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="@container space-y-4">
      {/* keyed by the saved values so the forms reset after every save */}
      <CapacityCard key={report.config.capacityMb} report={report} onSaved={() => load()} />
      <CompressionCard
        key={`${report.config.compress}-${report.config.maxEdge}-${report.config.quality}`}
        report={report}
        onChanged={() => load()}
      />
    </div>
  );
}

// ---------- 1. capacity ----------

function CapacityCard({ report, onSaved }: { report: StorageReportDTO; onSaved: () => void }) {
  const usedPct = pct(report.usedBytes, report.capacityBytes);
  const [capacity, setCapacity] = useState(String(report.config.capacityMb));
  const [saving, setSaving] = useState(false);

  const dirty = capacity !== String(report.config.capacityMb);
  const saveCapacity = async () => {
    const mb = Number(capacity);
    if (!Number.isInteger(mb) || mb < 64) {
      toast.error("Enter the plan size in MB (at least 64)");
      return;
    }
    setSaving(true);
    try {
      await updateStorageConfig({ capacityMb: mb });
      toast.success("Capacity saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const tone = usedPct >= 90 ? "text-danger" : usedPct >= 75 ? "text-warning" : "text-foreground";
  const sorted = [...report.categories].sort((a, b) => b.bytes - a.bytes);

  return (
    <Card
      title="Database storage"
      caption="Everything the site stores lives in the Neon Postgres database - including uploaded images and files."
      icon={Database}
    >
      {/* headline numbers */}
      <div className="mt-5 grid grid-cols-1 gap-3 @min-[36rem]:grid-cols-3">
        {[
          { label: "Used", value: formatBytes(report.usedBytes), sub: `${usedPct.toFixed(1)}% of capacity`, cls: tone },
          { label: "Free", value: formatBytes(report.freeBytes), sub: `${(100 - Math.min(100, usedPct)).toFixed(1)}% left`, cls: "text-success" },
          { label: "Capacity", value: formatBytes(report.capacityBytes), sub: "Your database plan limit", cls: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-up-border bg-surface-muted/40 p-3.5">
            <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums tracking-tight", s.cls)}>{s.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {usedPct >= 75 ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft/60 px-3 py-2.5 text-xs leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          The database is {usedPct.toFixed(0)}% full. Compress existing images below, or delete old
          emails and activity entries to free space. When it is full, uploads and new projects fail.
        </p>
      ) : null}

      {/* stacked bar: categories + free space */}
      <div className="mt-5">
        <div
          className="flex h-4 w-full overflow-hidden rounded-full bg-surface-muted ring-1 ring-up-border"
          role="img"
          aria-label={`${formatBytes(report.usedBytes)} used of ${formatBytes(report.capacityBytes)}`}
        >
          {sorted
            .filter((c) => c.bytes > 0)
            .map((c) => (
              <div
                key={c.key}
                className={cn("h-full", COLORS[c.key] ?? "bg-slate-400")}
                style={{ width: `${Math.max(0.4, pct(c.bytes, Math.max(report.capacityBytes, report.usedBytes)))}%` }}
                title={`${c.label}: ${formatBytes(c.bytes)}`}
              />
            ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[0.75rem] text-muted-foreground">
          <span>0</span>
          <span>{formatBytes(report.capacityBytes)}</span>
        </div>
      </div>

      {/* categories */}
      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 @min-[44rem]:grid-cols-2">
        {sorted.map((c) => (
          <li key={c.key} className="flex items-center gap-3 border-b border-up-border/60 py-2.5 last:border-0">
            <span className={cn("size-2.5 shrink-0 rounded-full", COLORS[c.key] ?? "bg-slate-400")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{c.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {c.hint}
                {c.files !== null ? ` · ${c.files} file${c.files === 1 ? "" : "s"}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums text-foreground">{formatBytes(c.bytes)}</span>
              <span className="block text-xs tabular-nums text-muted-foreground">
                {pct(c.bytes, report.usedBytes).toFixed(1)}% of used
              </span>
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 py-2.5">
          <span className="size-2.5 shrink-0 rounded-full bg-surface-muted ring-1 ring-up-border-strong" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">Free space</span>
            <span className="block text-xs text-muted-foreground">Available before the plan limit</span>
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-success">{formatBytes(report.freeBytes)}</span>
        </li>
      </ul>

      {/* capacity setting */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-up-border bg-surface-muted/40 p-3.5">
        <div className="min-w-0 flex-1 basis-60 space-y-1.5">
          <Label htmlFor="storage-capacity">Plan capacity (MB)</Label>
          <p className="text-xs text-muted-foreground">
            Neon&apos;s free plan is 512 MB (0.5 GB). Change this if you upgrade the plan.
          </p>
        </div>
        <Input
          id="storage-capacity"
          inputMode="numeric"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value.replace(/\D/g, "").slice(0, 7))}
          className="h-9 w-28 tabular-nums"
        />
        <Button size="sm" className="h-9 gap-1.5 rounded-lg" disabled={!dirty || saving} onClick={saveCapacity}>
          {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
          Save
        </Button>
      </div>
    </Card>
  );
}

// ---------- 2 + 3. compression ----------

const EDGE_OPTIONS = [
  { value: 1280, label: "1280 px - smallest files" },
  { value: 1920, label: "1920 px - Full HD (recommended)" },
  { value: 2560, label: "2560 px - sharper on big screens" },
  { value: 3840, label: "3840 px - 4K, largest files" },
];

const QUALITY_OPTIONS = [
  { value: 60, label: "60 - strong compression" },
  { value: 70, label: "70 - smaller" },
  { value: 80, label: "80 - balanced (recommended)" },
  { value: 90, label: "90 - near original" },
];

function CompressionCard({ report, onChanged }: { report: StorageReportDTO; onChanged: () => void }) {
  const [form, setForm] = useState<StorageConfigDTO>(report.config);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<{ done: number; total: number; saved: number } | null>(null);
  const cancelRef = useRef(false);
  useEffect(() => () => void (cancelRef.current = true), []);

  const dirty =
    form.compress !== report.config.compress ||
    form.maxEdge !== report.config.maxEdge ||
    form.quality !== report.config.quality;

  const save = async () => {
    setSaving(true);
    try {
      await updateStorageConfig({ compress: form.compress, maxEdge: form.maxEdge, quality: form.quality });
      toast.success("Image settings saved - they apply to the next upload");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const runJob = async () => {
    const total = report.images.uncompressed;
    cancelRef.current = false;
    setJob({ done: 0, total, saved: 0 });
    let done = 0;
    let saved = 0;
    try {
      for (;;) {
        if (cancelRef.current) break;
        const r = await compressExistingImages();
        done += r.processed;
        saved += r.savedBytes;
        setJob({ done, total: Math.max(total, done + r.remaining), saved });
        if (r.remaining === 0 || r.processed === 0) break;
      }
      toast.success(`Compressed ${done} image${done === 1 ? "" : "s"} - saved ${formatBytes(saved)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compression stopped");
    } finally {
      setJob(null);
      onChanged();
    }
  };

  const pending = report.images.uncompressed;

  return (
    <Card
      title="Image compression"
      caption="Shrink photos as they are uploaded - covers, galleries, avatars and the hero image."
      icon={ImageDown}
    >
      <div className="mt-5 space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-up-border p-3.5">
          <div className="min-w-0">
            <Label htmlFor="compress-switch" className="text-sm font-semibold">
              Compress new uploads
            </Label>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Large photos are scaled down and saved as WebP - usually 60–90% smaller with no visible
              difference. Animated GIFs and documents are left as they are.
            </p>
          </div>
          <Switch
            id="compress-switch"
            checked={form.compress}
            onCheckedChange={(v) => setForm((f) => ({ ...f, compress: v }))}
          />
        </div>

        <div className={cn("grid grid-cols-1 gap-3 @min-[36rem]:grid-cols-2", !form.compress && "opacity-50")}>
          <div className="space-y-1.5">
            <Label htmlFor="compress-edge">Maximum size (longest side)</Label>
            <Select
              value={String(form.maxEdge)}
              onValueChange={(v) => setForm((f) => ({ ...f, maxEdge: Number(v) }))}
              disabled={!form.compress}
            >
              <SelectTrigger id="compress-edge" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(EDGE_OPTIONS.some((o) => o.value === form.maxEdge)
                  ? EDGE_OPTIONS
                  : [...EDGE_OPTIONS, { value: form.maxEdge, label: `${form.maxEdge} px` }]
                ).map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compress-quality">Quality</Label>
            <Select
              value={String(form.quality)}
              onValueChange={(v) => setForm((f) => ({ ...f, quality: Number(v) }))}
              disabled={!form.compress}
            >
              <SelectTrigger id="compress-quality" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(QUALITY_OPTIONS.some((o) => o.value === form.quality)
                  ? QUALITY_OPTIONS
                  : [...QUALITY_OPTIONS, { value: form.quality, label: String(form.quality) }]
                ).map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button className="gap-1.5 rounded-xl font-semibold" disabled={!dirty || saving} onClick={save}>
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
            Save image settings
          </Button>
        </div>

        {/* existing images */}
        <div className="rounded-xl border border-up-border bg-surface-muted/40 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-sm font-semibold text-foreground">Images already uploaded</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {pending > 0
                  ? `${pending} of ${report.images.total} images were uploaded before compression and can be shrunk. They keep the same link and format, using the size and quality above.`
                  : report.images.total > 0
                    ? `All ${report.images.total} images are already compressed.`
                    : "No images uploaded yet."}
              </p>
            </div>
            {job ? (
              <Button variant="outline" className="rounded-xl" onClick={() => (cancelRef.current = true)}>
                Stop
              </Button>
            ) : (
              <Button
                variant="outline"
                className="gap-1.5 rounded-xl font-semibold"
                disabled={pending === 0 || dirty}
                title={dirty ? "Save the image settings first" : undefined}
                onClick={runJob}
              >
                <ImageDown className="size-4" aria-hidden />
                Compress {pending > 0 ? pending : ""} images
              </Button>
            )}
          </div>
          {job ? (
            <div className="mt-3" aria-live="polite">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted ring-1 ring-up-border">
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${pct(job.done, job.total || 1)}%` }}
                />
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                {job.done} of {job.total} done · {formatBytes(job.saved)} saved so far
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
