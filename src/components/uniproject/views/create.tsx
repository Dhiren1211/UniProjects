"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  Crown,
  FileCheck2,
  ImagePlus,
  Link2,
  Loader2,
  Lock,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, SEMESTERS, YEARS } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  addMember,
  addResource,
  addTimelineItem,
  createProject,
  createTechnology,
  deleteResource,
  deleteTimelineItem,
  fetchDepartments,
  fetchProject,
  fetchTechnologies,
  removeMember,
  searchUsers,
  updateMember,
  updateProject,
  uploadFile,
  type DepartmentDTO,
  type MemberDTO,
  type Navigate,
  type ProjectDetail,
  type ProjectDetailResponse,
  type ProjectInput,
  type ResourceDTO,
  type SafeUserDTO,
  type TechnologyDTO,
  type TimelineDTO,
} from "../api-client";
import { useAppStore } from "../store";
import { EmptyState, UserAvatar } from "../ui-bits";

// ---------- constants / helpers ----------

const STEPS = [
  { n: 1, label: "Basics", hint: "Title, summary, description & tags" },
  { n: 2, label: "Media", hint: "Cover image & gallery" },
  { n: 3, label: "Academics", hint: "Department, year & course" },
  { n: 4, label: "Team", hint: "Teammates & roles" },
  { n: 5, label: "Technologies", hint: "Tools & stacks used" },
  { n: 6, label: "Resources", hint: "Links, files & milestones" },
] as const;

const RESOURCE_TYPES = [
  { value: "DEMO", label: "Live demo" },
  { value: "GITHUB", label: "GitHub repo" },
  { value: "DOCUMENT", label: "Document" },
  { value: "VIDEO", label: "Video" },
  { value: "PRESENTATION", label: "Presentation" },
] as const;

const URL_RE = /^https?:\/\/\S+/i;

const RESOURCE_FILE_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif";

/** Decoded basename of an /uploads/… path (falls back to the raw string). */
function uploadBaseName(url: string) {
  const last = url.split("/").pop() ?? url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

// ---------- cover cropping ----------

type CropArea = { x: number; y: number; width: number; height: number };

/** Covers display at 16:9 on the project page hero. */
const COVER_ASPECT = 16 / 9;
const COVER_MAX_EDGE = 1600;

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load that image"));
    img.src = src;
  });
}

/** Pixel-crop an image onto a canvas and return an upload-ready JPEG File. */
async function cropToJpegFile(src: string, area: CropArea): Promise<File> {
  const img = await loadImageEl(src);
  const scale = Math.min(1, COVER_MAX_EDGE / Math.max(area.width, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images right now");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );
  if (!blob) throw new Error("Couldn't process the cropped image");
  return new File([blob], `cover-${Date.now()}.jpg`, { type: "image/jpeg" });
}

type FormState = {
  title: string;
  summary: string;
  description: string;
  dept: string;
  category: string;
  year: string;
  semester: string;
  program: string;
  supervisor: string;
  tags: string[];
  allowJoinRequests: boolean;
  lookingForTeammates: boolean;
  technologyIds: string[];
  coverImage: string;
  galleryImages: string[];
};

const EMPTY_FORM: FormState = {
  title: "",
  summary: "",
  description: "",
  dept: "",
  category: "",
  year: "",
  semester: "",
  program: "",
  supervisor: "",
  tags: [],
  allowJoinRequests: true,
  lookingForTeammates: false,
  technologyIds: [],
  coverImage: "",
  galleryImages: [],
};

type DraftResource = {
  key: string;
  type: string;
  label: string;
  url: string; // https:// link in "link" mode, /uploads/… path in "upload" mode
  mode: "link" | "upload";
  fileName?: string;
};
type DraftMilestone = { key: string; title: string; date: string; note: string };
type DraftMember = { username: string; name: string; role: string; avatarUrl?: string | null };

let rowSeq = 0;
const newRowKey = () => `row-${++rowSeq}`;

function errOf(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

/** Maps a server error message back to the wizard step that most likely caused it. */
function stepForMessage(msg: string): number {
  const m = msg.toLowerCase();
  if (/technolog/.test(m)) return 5;
  if (/(member|teammate|username)/.test(m)) return 4;
  if (/(cover|gallery|image)/.test(m)) return 2;
  if (/(department|category|semester|supervisor|program|academic|year)/.test(m)) return 3;
  if (/(url|resource|timeline|milestone|date|link)/.test(m)) return 6;
  return 1; // title / summary / description and anything generic
}

function WizardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-12">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-surface-muted" />
      <div className="mt-8 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
        <div className="hidden space-y-3 lg:block" aria-hidden>
          {STEPS.map((s) => (
            <div key={s.n} className="flex items-center gap-3 px-2 py-2">
              <div className="size-7 shrink-0 animate-pulse rounded-full bg-surface-muted" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-20 animate-pulse rounded bg-surface-muted" />
                <div className="h-2.5 w-28 animate-pulse rounded bg-surface-muted" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-5 rounded-2xl border border-up-border bg-card p-6 md:p-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-surface-muted" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-surface-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- tag input (step 1) ----------

const MAX_TAGS = 8;

const TAG_SUGGESTIONS = [
  "ai",
  "machine-learning",
  "computer-vision",
  "accessibility",
  "sustainability",
  "healthcare",
  "web-app",
  "mobile",
  "iot",
  "robotics",
  "education",
  "game-dev",
];

/** Clean up a raw tag token: trim, drop leading #'s, lowercase, whitespace → dashes. */
function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** GitHub-topic-style tag box — type + Enter to add, × / Backspace to remove. */
function TagField({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const commit = (raw: string) => {
    const tag = normalizeTag(raw);
    setDraft("");
    if (!tag) {
      setNotice(null);
      return;
    }
    if (tag.length > 30) {
      setNotice("Each tag must be 30 characters or less.");
    } else if (value.length >= MAX_TAGS) {
      setNotice(`You can add up to ${MAX_TAGS} tags.`);
    } else if (value.includes(tag)) {
      setNotice(`#${tag} is already on the list.`);
    } else {
      setNotice(null);
      onChange([...value, tag]);
    }
  };

  const suggestions = TAG_SUGGESTIONS.filter((s) => !value.includes(s)).slice(0, 6);
  const canAdd = value.length < MAX_TAGS;

  return (
    <div>
      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-up-border bg-white px-3 py-2",
          "transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
        )}
      >
        {value.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded-full bg-surface-muted py-0.5 pl-3 pr-1.5 text-xs font-medium text-foreground"
          >
            #{t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              aria-label={`Remove tag ${t}`}
              className="flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-danger"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        {canAdd ? (
          <input
            id="f-tags"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (notice) setNotice(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit(draft);
              } else if (e.key === "Backspace" && !draft && value.length) {
                onChange(value.slice(0, -1));
              }
            }}
            onBlur={() => draft.trim() && commit(draft)}
            placeholder={value.length ? "Add another…" : "e.g. accessibility, computer-vision"}
            aria-label="Add a tag"
            maxLength={40}
            className="h-6 min-w-28 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        ) : null}
      </div>

      {notice ? (
        <p className="mt-1.5 text-xs font-medium text-danger" aria-live="polite">
          {notice}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Press Enter to add — {value.length}/{MAX_TAGS} used. Tags are searchable and shown on the
          project page.
        </p>
      )}

      {canAdd && suggestions.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Suggested:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // keep input focus — avoids blur-commit racing the click
                commit(s);
              }}
              className="rounded-full border border-dashed border-up-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Vertical step rail (≥ lg) — lives on the side of the wizard, shows what each step covers. */
function StepRail({ current, onGo }: { current: number; onGo: (n: number) => void }) {
  return (
    <ol aria-label="Wizard steps" className="space-y-1">
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const isCurrent = s.n === current;
        const last = i === STEPS.length - 1;
        return (
          <li key={s.n} className="relative">
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[21px] top-9 z-10 h-[calc(100%-2.25rem)] w-px",
                  done ? "bg-primary-100" : "bg-up-border"
                )}
              />
            ) : null}
            <button
              type="button"
              disabled={!done}
              onClick={() => onGo(s.n)}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "relative flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                done && "cursor-pointer hover:bg-surface-muted",
                isCurrent && "bg-primary-50"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums transition-colors",
                  done && "border-primary-500 bg-primary-500 text-white",
                  isCurrent && "border-primary-500 bg-white text-primary-700 shadow-sm",
                  !done && !isCurrent && "border-up-border-strong bg-white text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : s.n}
              </span>
              <span className="min-w-0 pt-0.5">
                <span
                  className={cn(
                    "block text-sm font-semibold leading-tight",
                    isCurrent ? "text-primary-700" : done ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    "mt-1 block text-xs leading-snug",
                    isCurrent ? "text-primary-600/90" : "text-muted-foreground/90"
                  )}
                >
                  {s.hint}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Stepper({ current, onGo }: { current: number; onGo: (n: number) => void }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2" aria-label="Wizard steps">
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const isCurrent = s.n === current;
        return (
          <li key={s.n} className="flex items-center">
            {i > 0 ? (
              <span aria-hidden className="mx-1.5 h-px w-5 bg-up-border-strong md:mx-2 md:w-8" />
            ) : null}
            <button
              type="button"
              disabled={!done}
              onClick={() => onGo(s.n)}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all duration-200 md:text-sm",
                done && "cursor-pointer bg-primary-500 text-white hover:bg-primary-600",
                isCurrent && "border-2 border-primary-500 bg-white text-primary-700",
                !done && !isCurrent && "cursor-default bg-surface-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : <span className="tabular-nums">{s.n}</span>}
              {s.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Debounced user search + per-row role select, shared by the team step. */
function UserSearchAdd({
  exclude,
  onPick,
}: {
  exclude: Set<string>;
  onPick: (u: SafeUserDTO, role: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [found, setFound] = useState<SafeUserDTO[] | null>(null);
  const [foundFor, setFoundFor] = useState("");
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [busyName, setBusyName] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const q = debounced;
    if (q.length < 2) return;
    const ac = new AbortController();
    searchUsers(q, ac.signal)
      .then((rows) => {
        setFound(rows);
        setFoundFor(q);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [debounced]);

  const ready = debounced.length >= 2 && foundFor === debounced;
  const visible = ready ? (found ?? []).filter((u) => !exclude.has(u.username.toLowerCase())) : null;

  const pick = (u: SafeUserDTO) => {
    setBusyName(u.id);
    setQuery("");
    Promise.resolve(onPick(u, roles[u.id] ?? "MEMBER"))
      .catch(() => {})
      .finally(() => setBusyName(null));
  };

  return (
    <div>
      <Label htmlFor="team-search">Find teammates</Label>
      <div className="relative mt-1.5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="team-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students by name or username…"
          className="h-10 rounded-xl bg-white pl-9"
          autoComplete="off"
        />
      </div>
      <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto nice-scroll">
        {visible === null ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            {debounced.length >= 2 ? "Searching…" : "Type at least 2 characters to search."}
          </p>
        ) : visible.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No matching students.</p>
        ) : (
          visible.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-2.5 rounded-xl border border-up-border bg-white px-3 py-2"
            >
              <UserAvatar name={u.displayName} avatarUrl={u.avatarUrl} ring={false} className="size-7" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{u.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
              </div>
              <Select value={roles[u.id] ?? "MEMBER"} onValueChange={(role) => setRoles((r) => ({ ...r, [u.id]: role }))}>
                <SelectTrigger
                  aria-label={`Role for ${u.displayName}`}
                  className="h-8 w-[92px] rounded-lg text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 rounded-lg px-3 font-semibold"
                disabled={busyName === u.id}
                onClick={() => pick(u)}
              >
                {busyName === u.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Add"}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Link / Upload segmented control shown on each resource row. */
function ResourceModeToggle({
  value,
  uploadDisabled,
  onChange,
}: {
  value: "link" | "upload";
  uploadDisabled?: boolean;
  onChange: (mode: "link" | "upload") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg bg-surface-muted p-0.5" role="group" aria-label="Resource source">
      <button
        type="button"
        aria-pressed={value === "link"}
        onClick={() => onChange("link")}
        className={cn(
          "rounded-[7px] px-2.5 py-1 text-xs font-semibold transition-colors duration-200",
          value === "link" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Link
      </button>
      <button
        type="button"
        aria-pressed={value === "upload"}
        disabled={uploadDisabled}
        title={uploadDisabled ? "Repositories must be links" : undefined}
        onClick={() => onChange("upload")}
        className={cn(
          "rounded-[7px] px-2.5 py-1 text-xs font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
          value === "upload" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
      >
        Upload
      </button>
    </div>
  );
}

/** Hidden-file-input flow that uploads a resource file into a row. */
function ResourceUploadField({
  busy,
  pct,
  done,
  fileName,
  onChoose,
}: {
  busy: boolean;
  pct: number;
  done: boolean;
  fileName: string | null;
  onChoose: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="min-w-0">
      <input
        ref={inputRef}
        type="file"
        accept={RESOURCE_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChoose(file);
          e.target.value = "";
        }}
      />
      {done ? (
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-up-border bg-surface-muted px-2.5 py-2 text-xs font-medium text-foreground">
          <FileCheck2 className="size-3.5 shrink-0 text-success" aria-hidden />
          <span className="truncate">{fileName ?? "Uploaded file"}</span>
          <Check className="size-3.5 shrink-0 text-success" aria-hidden />
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-lg font-semibold"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
          {busy ? `Uploading ${pct}%` : "Choose file"}
        </Button>
      )}
      {busy ? (
        <div
          className="mt-1.5 h-1 w-full max-w-56 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Upload progress"
        >
          <div
            className="h-full rounded-full bg-primary-500 transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Selectable technology chip shared by the preset groups and "Other tools". */
function TechChip({ tech, on, onToggle }: { tech: TechnologyDTO; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
        on
          ? "border-primary-500 bg-primary-500 text-white shadow-sm"
          : "border-up-border bg-white text-foreground hover:border-up-border-strong hover:shadow-sm"
      )}
    >
      {on ? <Check className="mr-1 inline size-3.5" aria-hidden /> : null}
      {tech.name}
    </button>
  );
}

// ---------- view ----------

export function CreateProjectView({ editSlug, navigate }: { editSlug?: string; navigate: Navigate }) {
  const { user, authLoaded, openAuth } = useAppStore();
  const editing = Boolean(editSlug);

  const [existing, setExisting] = useState<ProjectDetailResponse | null>(null);
  const [editBlocked, setEditBlocked] = useState(false);
  const [editFailed, setEditFailed] = useState(false);
  const [editRetry, setEditRetry] = useState(0);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"" | "draft" | "final">("");

  const [draftMembers, setDraftMembers] = useState<DraftMember[]>([]);
  const [draftResources, setDraftResources] = useState<DraftResource[]>([]);
  const [draftTimeline, setDraftTimeline] = useState<DraftMilestone[]>([]);
  const [memberBusy, setMemberBusy] = useState<string | null>(null);

  const [coverPct, setCoverPct] = useState<number | null>(null);
  const [coverDrag, setCoverDrag] = useState(false);
  const [showCoverUrl, setShowCoverUrl] = useState(false);
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropPoint, setCropPoint] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [cropBusy, setCropBusy] = useState(false);
  const cropObjectUrl = useRef<string | null>(null);
  const [galleryPct, setGalleryPct] = useState<number | null>(null);
  const [newTech, setNewTech] = useState("");
  const [techBusy, setTechBusy] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [techs, setTechs] = useState<TechnologyDTO[] | null>(null);

  const [newRes, setNewRes] = useState<{
    type: string;
    label: string;
    url: string;
    mode: "link" | "upload";
    fileName?: string;
  }>({ type: "DEMO", label: "", url: "", mode: "link" });
  const [resErr, setResErr] = useState<string | null>(null);
  const [resBusy, setResBusy] = useState(false);
  const [resUploads, setResUploads] = useState<Record<string, number>>({});
  const [newMile, setNewMile] = useState<{ title: string; date: string; note: string }>({
    title: "",
    date: "",
    note: "",
  });
  const [mileErr, setMileErr] = useState<string | null>(null);
  const [mileBusy, setMileBusy] = useState(false);

  // departments are static — load once
  useEffect(() => {
    const ac = new AbortController();
    fetchDepartments(ac.signal)
      .then(setDepartments)
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // edit mode: load the project and populate the form
  useEffect(() => {
    if (!editSlug || !user) return;
    const ac = new AbortController();
    fetchProject(editSlug, ac.signal)
      .then(({ project, viewer }) => {
        if (!viewer.isOwner) {
          setEditBlocked(true);
          return;
        }
        setExisting({ project, viewer });
        setForm({
          title: project.title,
          summary: project.summary,
          description: project.description,
          dept: project.department.code,
          category: project.category,
          year: String(project.year),
          semester: project.semester,
          program: project.program ?? "",
          supervisor: project.supervisor ?? "",
          tags: project.tags,
          allowJoinRequests: project.allowJoinRequests,
          lookingForTeammates: project.lookingForTeammates,
          technologyIds: project.technologies.map((t) => t.id),
          coverImage: project.coverImage ?? "",
          galleryImages: project.galleryImages ?? [],
        });
      })
      .catch(() => {
        if (!ac.signal.aborted) setEditFailed(true);
      });
    return () => ac.abort();
  }, [editSlug, user?.id, editRetry]);

  // technologies are only needed on step 5 — lazy load
  useEffect(() => {
    if (step !== 5 || techs !== null) return;
    const ac = new AbortController();
    fetchTechnologies(ac.signal)
      .then(setTechs)
      .catch(() => setTechs([]));
    return () => ac.abort();
  }, [step, techs]);

  // "Other" technologies are pulled out of the groups and rendered in their own
  // always-present block next to the custom-tool input.
  const { techGroups, otherTechs } = useMemo(() => {
    const groups: { category: string; items: TechnologyDTO[] }[] = [];
    const idx = new Map<string, number>();
    const others: TechnologyDTO[] = [];
    for (const t of techs ?? []) {
      if (t.category === "Other") {
        others.push(t);
        continue;
      }
      const i = idx.get(t.category);
      if (i === undefined) {
        idx.set(t.category, groups.length);
        groups.push({ category: t.category, items: [t] });
      } else {
        groups[i].items.push(t);
      }
    }
    return { techGroups: groups, otherTechs: others };
  }, [techs]);

  // ---------- gates ----------

  if (!authLoaded) return <WizardSkeleton />;

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-24 md:px-8">
        <EmptyState
          icon={Lock}
          title={editing ? "Sign in to edit a project" : "Sign in to submit a project"}
          hint="You need a student account to publish projects on the showcase."
          action={
            <Button onClick={() => openAuth("login")} className="rounded-xl font-semibold">
              Sign in
            </Button>
          }
        />
      </div>
    );
  }

  if (editing && editBlocked) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-24 md:px-8">
        <EmptyState
          icon={ShieldAlert}
          title="You can't edit this project"
          hint="Only the project owner can make changes to it."
          action={
            <Button onClick={() => navigate({ name: "projects" })} variant="outline" className="rounded-xl font-semibold">
              Back to projects
            </Button>
          }
        />
      </div>
    );
  }

  if (editing && editFailed) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-24 md:px-8">
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          hint="We couldn't load this project for editing."
          action={
            <Button
              onClick={() => {
                setEditFailed(false);
                setEditRetry((r) => r + 1);
              }}
              variant="outline"
              className="rounded-xl font-semibold"
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (editing && !existing) return <WizardSkeleton />;

  const editProject = existing?.project ?? null;
  const publishNow = editing && editProject ? editProject.status === "DRAFT" : false;

  // ---------- form helpers ----------

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  const fieldErr = (key: string) =>
    errors[key] ? <p className="text-xs font-medium text-danger">{errors[key]}</p> : null;

  const validateStep = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 1) {
      const t = form.title.trim();
      if (t.length < 4) e.title = "Title must be at least 4 characters";
      const sum = form.summary.trim();
      if (sum.length < 20) e.summary = `Summary must be at least 20 characters (${sum.length}/20)`;
      const d = form.description.trim();
      if (d.length < 60) e.description = `Description must be at least 60 characters (${d.length}/60)`;
    }
    if (s === 2) {
      if (!form.coverImage.trim()) e.coverImage = "Add a cover image — every project needs one.";
    }
    if (s === 3) {
      if (!form.dept) e.dept = "Choose a department";
      if (!form.category) e.category = "Choose a category";
      if (!form.year) e.year = "Choose a year";
      if (!form.semester) e.semester = "Choose a semester";
    }
    return e;
  };

  const validateCore = (): { step: number; errors: Record<string, string> } | null => {
    const e1 = validateStep(1);
    if (Object.keys(e1).length) return { step: 1, errors: e1 };
    const e2 = validateStep(2);
    if (Object.keys(e2).length) return { step: 2, errors: e2 };
    return null;
  };

  const draftRowError = (): string | null => {
    for (const r of draftResources) {
      if (r.mode === "upload") {
        if (!r.url.startsWith("/uploads/")) return "Upload a file first — or switch the row back to Link.";
        continue;
      }
      if (!r.url.trim()) continue;
      if (!URL_RE.test(r.url.trim())) return "A resource link is not a valid URL — use the full http(s):// address.";
    }
    for (const t of draftTimeline) {
      if (!t.title.trim() && !t.date && !t.note.trim()) continue;
      if (!t.title.trim() || !t.date) return "Milestones need both a title and a date (empty rows are ignored).";
    }
    return null;
  };

  const corePayload = (publish: boolean): ProjectInput => ({
    title: form.title.trim(),
    summary: form.summary.trim(),
    description: form.description.trim(),
    category: form.category,
    year: Number(form.year),
    semester: form.semester,
    dept: form.dept,
    program: form.program.trim() || undefined,
    supervisor: form.supervisor.trim() || undefined,
    tags: form.tags,
    publish,
    technologyIds: form.technologyIds,
    allowJoinRequests: form.allowJoinRequests,
    lookingForTeammates: form.lookingForTeammates,
    coverImage: form.coverImage,
    galleryImages: form.galleryImages,
    members: draftMembers.map(({ username, role }) => ({ username, role })),
  });

  const onSubmitError = (err: unknown) => {
    const msg = errOf(err, "Something went wrong");
    setStep(stepForMessage(msg));
    setStepError(msg);
    toast.error(msg);
  };

  // ---------- edit-mode live mutations (members / resources / timeline) ----------

  const reloadLists = () => {
    if (!editSlug) return;
    fetchProject(editSlug)
      .then(({ project }) => {
        setExisting((ex) =>
          ex
            ? {
                ...ex,
                project: {
                  ...ex.project,
                  members: project.members,
                  resources: project.resources,
                  timeline: project.timeline,
                },
              }
            : ex
        );
      })
      .catch(() => {});
  };

  const patchProject = (patch: Partial<ProjectDetail>) =>
    setExisting((ex) => (ex ? { ...ex, project: { ...ex.project, ...patch } } : ex));

  const changeMemberRole = (m: MemberDTO, role: string) => {
    if (!editSlug || role === m.role) return;
    setMemberBusy(m.id);
    updateMember(editSlug, { memberId: m.id, role })
      .then(() => {
        toast.success(`${m.name} is now ${role === "LEAD" ? "a lead" : "a member"}`);
        reloadLists();
      })
      .catch((e: unknown) => toast.error(errOf(e, "Update failed")))
      .finally(() => setMemberBusy(null));
  };

  const removeMemberNow = (m: MemberDTO) => {
    if (!editSlug) return;
    setMemberBusy(m.id);
    removeMember(editSlug, { memberId: m.id })
      .then(() => {
        toast.success(`${m.name} was removed from the team`);
        reloadLists();
      })
      .catch((e: unknown) => toast.error(errOf(e, "Remove failed")))
      .finally(() => setMemberBusy(null));
  };

  const addMemberNow = (u: SafeUserDTO, role: string) => {
    if (!editSlug) return;
    addMember(editSlug, { username: u.username, role })
      .then(() => {
        toast.success(`${u.displayName} joined the team`);
        reloadLists();
      })
      .catch((e: unknown) => toast.error(errOf(e, "Could not add teammate")));
  };

  const addResourceNow = () => {
    if (!editSlug) return;
    if (!newRes.label.trim()) {
      setResErr("Give the resource a short label.");
      return;
    }
    if (newRes.mode === "upload") {
      if (!newRes.url.startsWith("/uploads/")) {
        setResErr("Upload a file first.");
        return;
      }
    } else if (!URL_RE.test(newRes.url.trim())) {
      setResErr("Enter a full URL starting with http:// or https://");
      return;
    }
    setResBusy(true);
    setResErr(null);
    addResource(editSlug, { type: newRes.type, label: newRes.label.trim(), url: newRes.url.trim() })
      .then(() => {
        toast.success("Resource added");
        setNewRes({ type: "DEMO", label: "", url: "", mode: "link" });
        reloadLists();
      })
      .catch((e: unknown) => setResErr(errOf(e, "Could not add resource")))
      .finally(() => setResBusy(false));
  };

  const deleteResourceNow = (r: ResourceDTO) => {
    if (!editSlug || !editProject) return;
    deleteResource(editSlug, r.id)
      .then(() => {
        toast.success("Resource removed");
        patchProject({ resources: editProject.resources.filter((x) => x.id !== r.id) });
      })
      .catch((e: unknown) => toast.error(errOf(e, "Delete failed")));
  };

  const addMilestoneNow = () => {
    if (!editSlug) return;
    if (!newMile.title.trim()) {
      setMileErr("Give the milestone a title.");
      return;
    }
    if (!newMile.date) {
      setMileErr("Pick a date.");
      return;
    }
    setMileBusy(true);
    setMileErr(null);
    addTimelineItem(editSlug, { title: newMile.title.trim(), date: newMile.date, note: newMile.note.trim() || undefined })
      .then(() => {
        toast.success("Milestone added");
        setNewMile({ title: "", date: "", note: "" });
        reloadLists();
      })
      .catch((e: unknown) => setMileErr(errOf(e, "Could not add milestone")))
      .finally(() => setMileBusy(false));
  };

  const deleteMilestoneNow = (t: TimelineDTO) => {
    if (!editSlug || !editProject) return;
    deleteTimelineItem(editSlug, t.id)
      .then(() => {
        toast.success("Milestone removed");
        patchProject({ timeline: editProject.timeline.filter((x) => x.id !== t.id) });
      })
      .catch((e: unknown) => toast.error(errOf(e, "Delete failed")));
  };

  // ---------- media uploads & custom tools ----------

  /** A freshly-picked cover always goes through the crop dialog before it uploads. */
  const onCoverFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file — JPG, PNG, WebP or GIF.");
      return;
    }
    if (cropObjectUrl.current) URL.revokeObjectURL(cropObjectUrl.current);
    const url = URL.createObjectURL(file);
    cropObjectUrl.current = url;
    setCropPoint({ x: 0, y: 0 });
    setCropZoom(1);
    setCropArea(null);
    setCropSrc(url);
    setCropOpen(true);
  };

  /** Re-crop an already-uploaded cover — only same-origin /uploads/ images are canvas-safe. */
  const startCoverCrop = () => {
    if (!form.coverImage.startsWith("/uploads/")) return;
    setCropPoint({ x: 0, y: 0 });
    setCropZoom(1);
    setCropArea(null);
    setCropSrc(form.coverImage);
    setCropOpen(true);
  };

  const closeCrop = () => {
    setCropOpen(false);
    setCropSrc(null);
    setCropArea(null);
    setCropBusy(false);
    if (cropObjectUrl.current) {
      URL.revokeObjectURL(cropObjectUrl.current);
      cropObjectUrl.current = null;
    }
  };

  const applyCrop = () => {
    if (!cropSrc || !cropArea) return;
    setCropBusy(true);
    cropToJpegFile(cropSrc, cropArea)
      .then((file) => uploadFile(file, "cover", setCoverPct))
      .then((url) => {
        setField("coverImage", url);
        toast.success("Cover image updated");
        closeCrop();
      })
      .catch((e: unknown) => toast.error(errOf(e, "Couldn't crop the cover image")))
      .finally(() => {
        setCropBusy(false);
        setCoverPct(null);
      });
  };

  const removeCover = () => setField("coverImage", "");

  const applyCoverUrl = () => {
    const v = coverUrlInput.trim();
    if (!v.startsWith("https://") && !v.startsWith("/")) {
      toast.error("Use an https:// link or a /… path");
      return;
    }
    setField("coverImage", v);
    setCoverUrlInput("");
    setShowCoverUrl(false);
  };

  const onGalleryFile = (file: File) => {
    setGalleryPct(0);
    uploadFile(file, "gallery", setGalleryPct)
      .then((url) => setForm((f) => ({ ...f, galleryImages: [...f.galleryImages, url].slice(0, 8) })))
      .catch((e: unknown) => toast.error(errOf(e, "Couldn't upload the photo")))
      .finally(() => setGalleryPct(null));
  };

  const moveGalleryImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.galleryImages.length) return;
    const next = [...form.galleryImages];
    [next[i], next[j]] = [next[j], next[i]];
    setField("galleryImages", next);
  };

  const removeGalleryImage = (i: number) =>
    setField("galleryImages", form.galleryImages.filter((_, idx) => idx !== i));

  const toggleTech = (id: string) =>
    setField(
      "technologyIds",
      form.technologyIds.includes(id)
        ? form.technologyIds.filter((x) => x !== id)
        : [...form.technologyIds, id]
    );

  const addTechnologyNow = () => {
    const name = newTech.trim();
    if (!name || techBusy) return;
    setTechBusy(true);
    createTechnology(name)
      .then((t) => {
        setTechs((list) => (list?.some((x) => x.id === t.id) ? list : [...(list ?? []), t]));
        setForm((f) =>
          f.technologyIds.includes(t.id) ? f : { ...f, technologyIds: [...f.technologyIds, t.id] }
        );
        toast.success(`${t.name} added to your tools`);
        setNewTech("");
      })
      .catch((e: unknown) => toast.error(errOf(e, "Couldn't add the tool")))
      .finally(() => setTechBusy(false));
  };

  const runResourceUpload = (key: string, file: File, onDone: (url: string) => void) => {
    setResUploads((m) => ({ ...m, [key]: 0 }));
    uploadFile(file, "resource", (pct) => setResUploads((m) => ({ ...m, [key]: pct })))
      .then(onDone)
      .catch((e: unknown) => toast.error(errOf(e, "Upload failed")))
      .finally(() =>
        setResUploads((m) => {
          const next = { ...m };
          delete next[key];
          return next;
        })
      );
  };

  const uploadDraftResource = (key: string, file: File) =>
    runResourceUpload(key, file, (url) =>
      setDraftResources((list) =>
        list.map((x) => (x.key === key ? { ...x, url, fileName: file.name } : x))
      )
    );

  const uploadNewResource = (file: File) =>
    runResourceUpload("new", file, (url) => setNewRes((s) => ({ ...s, url, fileName: file.name })));

  // ---------- navigation / submit ----------

  const goNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    setStepError(null);
    setStep((s) => Math.min(STEPS.length, s + 1));
  };

  const goBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      setStepError(null);
      return;
    }
    navigate(editing && editSlug ? { name: "project", slug: editSlug } : { name: "projects" });
  };

  const saveDraft = () => {
    const core = validateCore();
    if (core) {
      setStep(core.step);
      setErrors(core.errors);
      setStepError("Fill in the required fields before saving a draft.");
      toast.error("Missing required fields");
      return;
    }
    const rowErr = draftRowError();
    if (rowErr) {
      setStep(STEPS.length);
      setStepError(rowErr);
      return;
    }
    setSaving("draft");
    setStepError(null);
    createProject(corePayload(false))
      .then((created) => {
        toast.success("Draft saved — publish whenever you're ready");
        navigate({ name: "project", slug: created.slug });
      })
      .catch(onSubmitError)
      .finally(() => setSaving(""));
  };

  const submitFinal = () => {
    const core = validateCore();
    if (core) {
      setStep(core.step);
      setErrors(core.errors);
      setStepError("Please fix the highlighted fields first.");
      return;
    }
    const rowErr = editing ? null : draftRowError();
    if (rowErr) {
      setStepError(rowErr);
      return;
    }
    setSaving("final");
    setStepError(null);

    if (editing && editSlug) {
      updateProject(editSlug, {
        title: form.title.trim(),
        summary: form.summary.trim(),
        description: form.description.trim(),
        category: form.category,
        year: Number(form.year),
        semester: form.semester,
        dept: form.dept,
        program: form.program.trim() || undefined,
        supervisor: form.supervisor.trim() || undefined,
        tags: form.tags,
        technologyIds: form.technologyIds,
        allowJoinRequests: form.allowJoinRequests,
        lookingForTeammates: form.lookingForTeammates,
        coverImage: form.coverImage,
        galleryImages: form.galleryImages,
        ...(publishNow ? { status: "PUBLISHED" as const } : {}),
      })
        .then(() => {
          toast.success(publishNow ? "Project published!" : "Changes saved");
          navigate({ name: "project", slug: editSlug });
        })
        .catch(onSubmitError)
        .finally(() => setSaving(""));
      return;
    }

    createProject(corePayload(true))
      .then((created) => {
        const slug = created.slug;
        // createProject has no resources/timeline fields — apply them best-effort
        const jobs: Promise<unknown>[] = [
          ...draftResources
            .filter((r) => r.url.trim())
            .map((r) =>
              addResource(slug, { type: r.type, label: r.label.trim() || r.fileName || r.type, url: r.url.trim() })
            ),
          ...draftTimeline
            .filter((t) => t.title.trim() && t.date)
            .map((t) =>
              addTimelineItem(slug, {
                title: t.title.trim(),
                date: t.date,
                note: t.note.trim() || undefined,
              })
            ),
        ];
        return Promise.all(jobs.map((j) => j.catch(() => null))).then(() => slug);
      })
      .then((slug) => {
        toast.success("Project published!");
        navigate({ name: "project", slug });
      })
      .catch(onSubmitError)
      .finally(() => setSaving(""));
  };

  // ---------- render ----------

  const stepLabel = STEPS[step - 1].label;
  const selectedTechs = (techs ?? []).filter((t) => form.technologyIds.includes(t.id));

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">
            {editing ? "Edit project" : "New submission"}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {editing ? "Edit project" : "Submit a project"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Step {step} of {STEPS.length} — {stepLabel}
        </p>
      </div>

      {/* < lg: horizontal stepper — ≥ lg the vertical rail sits beside the form */}
      <div className="mt-6 lg:hidden">
        <Stepper current={step} onGo={(n) => setStep(n)} />
      </div>

      <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
        {/* Vertical step rail (≥ lg) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <StepRail current={step} onGo={(n) => setStep(n)} />
          </div>
        </aside>

        <div className="min-w-0">
          {stepError ? (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
            >
              {stepError}
            </div>
          ) : null}

      {/* Step card */}
      <section className="rounded-2xl border border-up-border bg-card p-6 md:p-8">
        {/* ---------- Step 1: Basics ---------- */}
        {step === 1 ? (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-title">Project title</Label>
              <Input
                id="f-title"
                value={form.title}
                maxLength={120}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="e.g. Smart compost tracker for campus cafeterias"
                aria-invalid={Boolean(errors.title)}
                className="h-10 rounded-xl bg-white"
              />
              <div className="flex items-start justify-between gap-3">
                {errors.title ? (
                  fieldErr("title")
                ) : (
                  <p className="text-xs text-muted-foreground">A clear, specific name (4–120 characters).</p>
                )}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {form.title.length}/120
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-summary">One-line summary</Label>
              <Input
                id="f-summary"
                value={form.summary}
                maxLength={220}
                onChange={(e) => setField("summary", e.target.value)}
                placeholder="What does it do, in one sentence?"
                aria-invalid={Boolean(errors.summary)}
                className="h-10 rounded-xl bg-white"
              />
              <div className="flex items-start justify-between gap-3">
                {errors.summary ? (
                  fieldErr("summary")
                ) : (
                  <p className="text-xs text-muted-foreground">Shown on cards and search results (20–220 characters).</p>
                )}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {form.summary.length}/220
                </span>
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="f-desc">Description</Label>
              <Textarea
                id="f-desc"
                rows={8}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder={"The problem, your approach, and what you built…\n\nUse plain text — leave a blank line between paragraphs."}
                aria-invalid={Boolean(errors.description)}
                className="rounded-xl bg-white"
              />
              <div className="flex items-start justify-between gap-3">
                {errors.description ? (
                  fieldErr("description")
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Plain text — blank lines become paragraph breaks.
                  </p>
                )}
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {form.description.length} chars
                </span>
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="f-tags">Tags</Label>
              <TagField value={form.tags} onChange={(tags) => setField("tags", tags)} />
            </div>
          </div>
        ) : null}

        {/* ---------- Step 2: Media ---------- */}
        {step === 2 ? (
          <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
            {/* Cover image */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">Cover image</p>
                  <p className="text-xs text-muted-foreground">
                    Shown on cards and the top of the project page — you pick the exact crop.
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">Required</span>
              </div>

              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onCoverFile(file);
                  e.target.value = "";
                }}
              />

              {form.coverImage ? (
                <div className="mt-3">
                  <div className="relative aspect-[16/7] overflow-hidden rounded-2xl border border-up-border bg-surface-muted">
                    <img
                      src={form.coverImage}
                      alt="Cover preview"
                      className="absolute inset-0 size-full object-cover"
                    />
                    {coverPct !== null ? (
                      <div className="absolute inset-x-0 bottom-0 bg-white/90 px-4 py-2.5 backdrop-blur">
                        <div className="flex items-center justify-between gap-2 pb-1.5">
                          <p className="text-xs font-medium text-foreground">Uploading new cover…</p>
                          <span className="text-xs tabular-nums text-muted-foreground">{coverPct}%</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full bg-primary-500 transition-[width] duration-200"
                            style={{ width: `${coverPct}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {form.coverImage.startsWith("/uploads/")
                        ? uploadBaseName(form.coverImage)
                        : form.coverImage}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {form.coverImage.startsWith("/uploads/") ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg font-semibold"
                          disabled={coverPct !== null}
                          onClick={startCoverCrop}
                        >
                          <Crop className="size-3.5" aria-hidden />
                          Crop
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg font-semibold"
                        disabled={coverPct !== null}
                        onClick={() => coverInputRef.current?.click()}
                      >
                        Replace
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg font-semibold text-muted-foreground hover:text-danger"
                        disabled={coverPct !== null}
                        onClick={removeCover}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label="Upload cover image"
                  disabled={coverPct !== null}
                  onClick={() => coverInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setCoverDrag(true);
                  }}
                  onDragLeave={() => setCoverDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setCoverDrag(false);
                    const file = e.dataTransfer.files[0];
                    if (file) onCoverFile(file);
                  }}
                  className={cn(
                    "mt-3 flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-white transition-colors duration-200",
                    coverDrag
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-up-border-strong text-muted-foreground hover:border-primary-400 hover:text-primary-700"
                  )}
                >
                  {coverPct !== null ? (
                    <>
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                      <p className="text-sm font-medium text-foreground">Uploading… {coverPct}%</p>
                      <div className="h-1 w-44 overflow-hidden rounded-full bg-surface-muted">
                        <div
                          className="h-full rounded-full bg-primary-500 transition-[width] duration-200"
                          style={{ width: `${coverPct}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="flex size-11 items-center justify-center rounded-xl bg-surface-muted">
                        <ImagePlus className="size-5" aria-hidden />
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        {coverDrag ? "Drop to upload" : "Click to upload or drag & drop"}
                      </p>
                      <p className="text-xs">JPG, PNG, WebP or GIF — up to 6 MB</p>
                      <p className="text-[11px] text-muted-foreground/80">
                        You'll crop it to fit before it uploads
                      </p>
                    </>
                  )}
                </button>
              )}

              {errors.coverImage ? <div className="mt-2">{fieldErr("coverImage")}</div> : null}

              <div className="mt-2.5">
                {showCoverUrl ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label="Cover image URL"
                      value={coverUrlInput}
                      onChange={(e) => setCoverUrlInput(e.target.value)}
                      placeholder="https://…"
                      inputMode="url"
                      className="h-9 min-w-0 flex-1 rounded-lg bg-white sm:max-w-sm"
                    />
                    <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold" onClick={applyCoverUrl}>
                      Apply
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg text-muted-foreground"
                      onClick={() => {
                        setShowCoverUrl(false);
                        setCoverUrlInput("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCoverUrl(true)}
                  >
                    <Link2 className="size-3.5" aria-hidden />
                    or paste an image link
                  </Button>
                )}
              </div>
            </div>

            {/* Gallery */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">Gallery</p>
                  <p className="text-xs text-muted-foreground">
                    Optional project photos — shown as a swipeable slider on the project page.
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {form.galleryImages.length}/8
                </span>
              </div>

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onGalleryFile(file);
                  e.target.value = "";
                }}
              />

              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {form.galleryImages.map((img, i) => (
                  <div
                    key={`${i}-${img}`}
                    className="relative aspect-square overflow-hidden rounded-xl border border-up-border bg-surface-muted"
                  >
                    <img
                      src={img}
                      alt={`Gallery photo ${i + 1}`}
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                    />
                    <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between gap-1">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label={`Move image ${i + 1} left`}
                          disabled={i === 0}
                          onClick={() => moveGalleryImage(i, -1)}
                          className="flex size-6 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm transition-colors hover:text-primary-700 disabled:opacity-30"
                        >
                          <ChevronLeft className="size-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move image ${i + 1} right`}
                          disabled={i === form.galleryImages.length - 1}
                          onClick={() => moveGalleryImage(i, 1)}
                          className="flex size-6 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm transition-colors hover:text-primary-700 disabled:opacity-30"
                        >
                          <ChevronRight className="size-3.5" aria-hidden />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove image ${i + 1}`}
                        onClick={() => removeGalleryImage(i)}
                        className="flex size-6 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm transition-colors hover:text-danger"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))}
                {galleryPct !== null ? (
                  <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-up-border bg-surface-muted">
                    <Loader2 className="size-5 animate-spin text-primary-600" aria-hidden />
                    <p className="text-xs font-medium text-muted-foreground">Uploading {galleryPct}%</p>
                    <div className="h-1 w-3/4 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-primary-500 transition-[width] duration-200"
                        style={{ width: `${galleryPct}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {form.galleryImages.length < 8 ? (
                  <button
                    type="button"
                    aria-label="Add gallery photo"
                    disabled={galleryPct !== null}
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-up-border-strong bg-white text-muted-foreground transition-colors duration-200 hover:border-primary-400 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus className="size-5" aria-hidden />
                    <span className="text-[11px] font-semibold">Add photo</span>
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Up to 8 photos — new ones join the end; use the corner arrows to rearrange.
              </p>
            </div>
          </div>
        ) : null}

        {/* ---------- Step 3: Academics ---------- */}
        {step === 3 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-dept">Department</Label>
              <Select
                value={form.dept || "__none__"}
                onValueChange={(v) => setField("dept", v === "__none__" ? "" : v)}
              >
                <SelectTrigger
                  id="f-dept"
                  aria-label="Department"
                  aria-invalid={Boolean(errors.dept)}
                  className="h-10 w-full rounded-xl bg-white"
                >
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.code}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErr("dept")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-category">Category</Label>
              <Select
                value={form.category || "__none__"}
                onValueChange={(v) => setField("category", v === "__none__" ? "" : v)}
              >
                <SelectTrigger
                  id="f-category"
                  aria-label="Category"
                  aria-invalid={Boolean(errors.category)}
                  className="h-10 w-full rounded-xl bg-white"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErr("category")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-year">Year</Label>
              <Select
                value={form.year || "__none__"}
                onValueChange={(v) => setField("year", v === "__none__" ? "" : v)}
              >
                <SelectTrigger
                  id="f-year"
                  aria-label="Year"
                  aria-invalid={Boolean(errors.year)}
                  className="h-10 w-full rounded-xl bg-white"
                >
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErr("year")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-semester">Semester</Label>
              <Select
                value={form.semester || "__none__"}
                onValueChange={(v) => setField("semester", v === "__none__" ? "" : v)}
              >
                <SelectTrigger
                  id="f-semester"
                  aria-label="Semester"
                  aria-invalid={Boolean(errors.semester)}
                  className="h-10 w-full rounded-xl bg-white"
                >
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErr("semester")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-program">Program (optional)</Label>
              <Input
                id="f-program"
                value={form.program}
                maxLength={80}
                onChange={(e) => setField("program", e.target.value)}
                placeholder="e.g. B.Sc. Computer Science"
                className="h-10 rounded-xl bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-supervisor">Supervisor (optional)</Label>
              <Input
                id="f-supervisor"
                value={form.supervisor}
                maxLength={80}
                onChange={(e) => setField("supervisor", e.target.value)}
                placeholder="e.g. Prof. Dana Kim"
                className="h-10 rounded-xl bg-white"
              />
            </div>
          </div>
        ) : null}

        {/* ---------- Step 4: Team ---------- */}
        {step === 4 ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
                <Crown className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{user.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  @{user.username} · You — project owner
                </p>
              </div>
            </div>

            <div>
              <Label>Teammates</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {editing
                  ? "Changes apply immediately."
                  : "They'll be tagged on the project when you publish."}
              </p>

              <div className="mt-3 space-y-2">
                {/* create mode: local draft rows */}
                {!editing
                  ? draftMembers.map((m) => (
                      <div
                        key={m.username}
                        className="flex items-center gap-3 rounded-xl border border-up-border bg-white px-3.5 py-2.5"
                      >
                        <UserAvatar name={m.name} avatarUrl={m.avatarUrl} ring={false} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                          <p className="truncate text-xs text-muted-foreground">@{m.username}</p>
                        </div>
                        <Select
                          value={m.role}
                          onValueChange={(role) =>
                            setDraftMembers((list) =>
                              list.map((x) => (x.username === m.username ? { ...x, role } : x))
                            )
                          }
                        >
                          <SelectTrigger
                            aria-label={`Role for ${m.name}`}
                            className="h-8 w-[100px] rounded-lg text-xs"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LEAD">Lead</SelectItem>
                            <SelectItem value="MEMBER">Member</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${m.name}`}
                          className="size-9 rounded-lg text-muted-foreground hover:text-danger"
                          onClick={() =>
                            setDraftMembers((list) => list.filter((x) => x.username !== m.username))
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    ))
                  : null}

                {/* edit mode: live member rows */}
                {editing && editProject
                  ? editProject.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-xl border border-up-border bg-white px-3.5 py-2.5"
                      >
                        <UserAvatar name={m.name} avatarUrl={m.avatarUrl} ring={false} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                          <p className="truncate text-xs text-muted-foreground">@{m.username}</p>
                        </div>
                        {m.role === "OWNER" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
                            <Crown className="size-3" aria-hidden />
                            Owner
                          </span>
                        ) : (
                          <>
                            <Select
                              value={m.role}
                              disabled={memberBusy === m.id}
                              onValueChange={(role) => changeMemberRole(m, role)}
                            >
                              <SelectTrigger
                                aria-label={`Role for ${m.name}`}
                                className="h-8 w-[100px] rounded-lg text-xs"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="LEAD">Lead</SelectItem>
                                <SelectItem value="MEMBER">Member</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${m.name}`}
                              disabled={memberBusy === m.id}
                              className="size-9 rounded-lg text-muted-foreground hover:text-danger"
                              onClick={() => removeMemberNow(m)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </>
                        )}
                      </div>
                    ))
                  : null}

                {(!editing && draftMembers.length === 0) || (editing && editProject && editProject.members.length <= 1) ? (
                  <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                    Flying solo for now — search below to add teammates.
                  </p>
                ) : null}
              </div>

              <div className="mt-4">
                <UserSearchAdd
                  exclude={
                    editing
                      ? new Set([user.username.toLowerCase(), ...(editProject?.members.map((m) => m.username.toLowerCase()) ?? [])])
                      : new Set([user.username.toLowerCase(), ...draftMembers.map((m) => m.username.toLowerCase())])
                  }
                  onPick={(u, role) => {
                    if (editing) {
                      addMemberNow(u, role);
                      return;
                    }
                    if (draftMembers.some((m) => m.username === u.username)) return;
                    setDraftMembers((list) => [
                      ...list,
                      { username: u.username, name: u.displayName, role, avatarUrl: u.avatarUrl },
                    ]);
                    toast.success(`${u.displayName} added to the team`);
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label
                htmlFor="sw-join"
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-up-border bg-white px-4 py-3.5 transition-colors hover:border-up-border-strong"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Allow join requests</span>
                  <span className="block text-xs text-muted-foreground">
                    Students can ask to join your team.
                  </span>
                </span>
                <Switch
                  id="sw-join"
                  checked={form.allowJoinRequests}
                  onCheckedChange={(v) => setField("allowJoinRequests", v)}
                />
              </label>
              <label
                htmlFor="sw-teammates"
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-up-border bg-white px-4 py-3.5 transition-colors hover:border-up-border-strong"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Looking for teammates</span>
                  <span className="block text-xs text-muted-foreground">
                    Shows an “open to teammates” badge.
                  </span>
                </span>
                <Switch
                  id="sw-teammates"
                  checked={form.lookingForTeammates}
                  onCheckedChange={(v) => setField("lookingForTeammates", v)}
                />
              </label>
            </div>
          </div>
        ) : null}

        {/* ---------- Step 5: Technologies ---------- */}
        {step === 5 ? (
          techs === null ? (
            <div className="flex flex-wrap gap-2" aria-hidden>
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-surface-muted" />
              ))}
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-start">
              {/* Chip groups — two columns on wide screens */}
              <div className="grid min-w-0 gap-x-6 gap-y-6 sm:grid-cols-2">
                {techGroups.length === 0 && otherTechs.length === 0 ? (
                  <p className="text-sm text-muted-foreground sm:col-span-2">
                    No preset technologies right now — add the tools your team used on the right.
                  </p>
                ) : null}
                {techGroups.map((g) => (
                  <div key={g.category}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {g.category}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {g.items.map((t) => (
                        <TechChip
                          key={t.id}
                          tech={t}
                          on={form.technologyIds.includes(t.id)}
                          onToggle={() => toggleTech(t.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {otherTechs.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Other tools
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {otherTechs.map((t) => (
                        <TechChip
                          key={t.id}
                          tech={t}
                          on={form.technologyIds.includes(t.id)}
                          onToggle={() => toggleTech(t.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Rail: selected-stack summary + custom-tool input */}
              <aside className="rounded-2xl border border-up-border bg-surface-muted/60 p-4 lg:sticky lg:top-24">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Your stack
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground" aria-live="polite">
                  {form.technologyIds.length} selected
                </p>
                {selectedTechs.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedTechs.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-full bg-primary-500 py-1 pl-2.5 pr-1.5 text-xs font-medium text-white"
                      >
                        {t.name}
                        <button
                          type="button"
                          aria-label={`Remove ${t.name}`}
                          onClick={() => toggleTech(t.id)}
                          className="flex size-4 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Nothing yet — tap the tools on the left to build your stack.
                  </p>
                )}

                <div className="mt-4 border-t border-up-border pt-3.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Missing a tool?
                  </p>
                  <Input
                    aria-label="Add a custom tool"
                    value={newTech}
                    maxLength={40}
                    onChange={(e) => setNewTech(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTechnologyNow();
                      }
                    }}
                    placeholder="Tool name…"
                    className="mt-2 h-9 w-full rounded-lg bg-white"
                  />
                  <Button
                    size="sm"
                    className="mt-2 h-9 w-full rounded-lg font-semibold"
                    disabled={techBusy || !newTech.trim()}
                    onClick={addTechnologyNow}
                  >
                    {techBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                    Add tool
                  </Button>
                </div>
              </aside>
            </div>
          )
        ) : null}

        {/* ---------- Step 6: Resources & timeline ---------- */}
        {step === 6 ? (
          <div className="space-y-8">
            {/* Resources */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">Resources</p>
                  <p className="text-xs text-muted-foreground">
                    {editing
                      ? "Added and removed immediately."
                      : "Demo, repo, docs, slides — up to 6 links or files."}
                  </p>
                </div>
                {!editing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg font-semibold"
                    disabled={draftResources.length >= 6}
                    onClick={() =>
                      setDraftResources((list) => [
                        ...list,
                        { key: newRowKey(), type: "DEMO", label: "", url: "", mode: "link" },
                      ])
                    }
                  >
                    <Plus className="size-4" aria-hidden />
                    Add resource
                  </Button>
                ) : null}
              </div>

              {/* create mode: local rows */}
              {!editing ? (
                <div className="mt-3 space-y-2.5">
                  {draftResources.map((r, i) => (
                    <div key={r.key} className="space-y-2 rounded-xl border border-up-border bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={r.type}
                          onValueChange={(v) =>
                            setDraftResources((list) =>
                              list.map((x) => {
                                if (x.key !== r.key) return x;
                                // uploaded files make no sense for source repos
                                if (v === "GITHUB" && x.mode === "upload") {
                                  return { ...x, type: v, mode: "link", url: "" };
                                }
                                return { ...x, type: v };
                              })
                            )
                          }
                        >
                          <SelectTrigger aria-label="Resource type" className="h-9 w-[140px] rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RESOURCE_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <ResourceModeToggle
                          value={r.mode}
                          uploadDisabled={r.type === "GITHUB"}
                          onChange={(m) =>
                            setDraftResources((list) =>
                              list.map((x) => {
                                if (x.key !== r.key) return x;
                                // a /uploads/… path is not a valid link — drop it on switch
                                if (m === "link" && x.url.startsWith("/uploads/")) {
                                  return { ...x, mode: m, url: "" };
                                }
                                return { ...x, mode: m };
                              })
                            )
                          }
                        />
                        <span className="min-w-2 flex-1" aria-hidden />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove resource ${i + 1}`}
                          className="size-9 rounded-lg text-muted-foreground hover:text-danger"
                          onClick={() => setDraftResources((list) => list.filter((x) => x.key !== r.key))}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          aria-label={`Resource ${i + 1} label`}
                          placeholder="Label — e.g. Figma prototype"
                          value={r.label}
                          onChange={(e) => setDraftResources((list) => list.map((x) => (x.key === r.key ? { ...x, label: e.target.value } : x)))}
                          className="h-9 rounded-lg"
                        />
                        {r.mode === "link" ? (
                          <Input
                            aria-label={`Resource ${i + 1} URL`}
                            placeholder="https://…"
                            inputMode="url"
                            value={r.url}
                            onChange={(e) => setDraftResources((list) => list.map((x) => (x.key === r.key ? { ...x, url: e.target.value } : x)))}
                            className="h-9 rounded-lg"
                          />
                        ) : (
                          <ResourceUploadField
                            done={r.url.startsWith("/uploads/")}
                            fileName={r.fileName ?? null}
                            busy={resUploads[r.key] !== undefined}
                            pct={resUploads[r.key] ?? 0}
                            onChoose={(file) => uploadDraftResource(r.key, file)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  {draftResources.length === 0 ? (
                    <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                      No resources yet — add demo links, repositories, documents, slides or files.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  <ul className="space-y-2">
                    {(editProject?.resources ?? []).map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl border border-up-border bg-white px-3.5 py-2.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {r.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.url.startsWith("/uploads/") ? (
                              <>Uploaded file · {uploadBaseName(r.url)}</>
                            ) : (
                              <>
                                {RESOURCE_TYPES.find((t) => t.value === r.type)?.label ?? r.type} · {r.url}
                              </>
                            )}
                          </span>
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete resource: ${r.label}`}
                          className="size-9 shrink-0 rounded-lg text-muted-foreground hover:text-danger"
                          onClick={() => deleteResourceNow(r)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </li>
                    ))}
                    {(editProject?.resources ?? []).length === 0 ? (
                      <li className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                        No resources yet — add the first one below.
                      </li>
                    ) : null}
                  </ul>
                  <div className="space-y-2 rounded-xl border border-dashed border-up-border-strong bg-surface-muted/60 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={newRes.type}
                        onValueChange={(v) =>
                          setNewRes((s) => {
                            if (v === "GITHUB" && s.mode === "upload") {
                              return { ...s, type: v, mode: "link", url: "" };
                            }
                            return { ...s, type: v };
                          })
                        }
                      >
                        <SelectTrigger aria-label="Resource type" className="h-9 w-[140px] rounded-lg text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESOURCE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ResourceModeToggle
                        value={newRes.mode}
                        uploadDisabled={newRes.type === "GITHUB"}
                        onChange={(m) =>
                          setNewRes((s) => {
                            if (m === "link" && s.url.startsWith("/uploads/")) {
                              return { ...s, mode: m, url: "" };
                            }
                            return { ...s, mode: m };
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                      <Input
                        aria-label="New resource label"
                        placeholder="Label"
                        value={newRes.label}
                        onChange={(e) => setNewRes((s) => ({ ...s, label: e.target.value }))}
                        className="h-9 rounded-lg bg-white"
                      />
                      {newRes.mode === "link" ? (
                        <Input
                          aria-label="New resource URL"
                          placeholder="https://…"
                          inputMode="url"
                          value={newRes.url}
                          onChange={(e) => setNewRes((s) => ({ ...s, url: e.target.value }))}
                          className="h-9 rounded-lg bg-white"
                        />
                      ) : (
                        <ResourceUploadField
                          done={newRes.url.startsWith("/uploads/")}
                          fileName={newRes.fileName ?? null}
                          busy={resUploads.new !== undefined}
                          pct={resUploads.new ?? 0}
                          onChoose={uploadNewResource}
                        />
                      )}
                      <Button
                        size="sm"
                        className="h-9 rounded-lg px-4 font-semibold"
                        disabled={resBusy}
                        onClick={addResourceNow}
                      >
                        {resBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                        Add
                      </Button>
                    </div>
                    {resErr ? (
                      <p className="text-xs font-medium text-danger">{resErr}</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">Timeline</p>
                  <p className="text-xs text-muted-foreground">
                    {editing
                      ? "Key moments, shown as a timeline on the project page."
                      : "Optional — up to 3 key moments (kickoff, demo day, …)."}
                  </p>
                </div>
                {!editing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg font-semibold"
                    disabled={draftTimeline.length >= 3}
                    onClick={() =>
                      setDraftTimeline((list) => [...list, { key: newRowKey(), title: "", date: "", note: "" }])
                    }
                  >
                    <Plus className="size-4" aria-hidden />
                    Add milestone
                  </Button>
                ) : null}
              </div>

              {!editing ? (
                <div className="mt-3 space-y-2.5">
                  {draftTimeline.map((t, i) => (
                    <div
                      key={t.key}
                      className="grid gap-2 rounded-xl border border-up-border bg-white p-3 sm:grid-cols-[1fr_170px_1fr_auto] sm:items-center"
                    >
                      <Input
                        aria-label={`Milestone ${i + 1} title`}
                        placeholder="Title — e.g. Kickoff"
                        value={t.title}
                        onChange={(e) => setDraftTimeline((list) => list.map((x) => (x.key === t.key ? { ...x, title: e.target.value } : x)))}
                        className="h-9 rounded-lg"
                      />
                      <Input
                        aria-label={`Milestone ${i + 1} date`}
                        type="date"
                        value={t.date}
                        onChange={(e) => setDraftTimeline((list) => list.map((x) => (x.key === t.key ? { ...x, date: e.target.value } : x)))}
                        className="h-9 rounded-lg"
                      />
                      <Input
                        aria-label={`Milestone ${i + 1} note`}
                        placeholder="Note (optional)"
                        value={t.note}
                        onChange={(e) => setDraftTimeline((list) => list.map((x) => (x.key === t.key ? { ...x, note: e.target.value } : x)))}
                        className="h-9 rounded-lg"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove milestone ${i + 1}`}
                        className="size-9 rounded-lg text-muted-foreground hover:text-danger"
                        onClick={() => setDraftTimeline((list) => list.filter((x) => x.key !== t.key))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ))}
                  {draftTimeline.length === 0 ? (
                    <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                      No milestones yet — optional, but they make the timeline pop.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 space-y-4">
                  <ol className="relative ml-1 space-y-5 border-l-2 border-up-border pl-6">
                    {(editProject?.timeline ?? []).map((t) => (
                      <li key={t.id} className="relative">
                        <span
                          aria-hidden
                          className="absolute -left-[31px] top-1 size-2.5 rounded-full bg-primary-500 ring-4 ring-white"
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{t.title}</p>
                            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{t.date.slice(0, 10)}</p>
                            {t.note ? (
                              <p className="mt-1 text-sm text-muted-foreground">{t.note}</p>
                            ) : null}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete milestone: ${t.title}`}
                            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-danger"
                            onClick={() => deleteMilestoneNow(t)}
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </li>
                    ))}
                    {(editProject?.timeline ?? []).length === 0 ? (
                      <li className="text-sm text-muted-foreground">No milestones yet.</li>
                    ) : null}
                  </ol>
                  <div className="grid gap-2 rounded-xl border border-dashed border-up-border-strong bg-surface-muted/60 p-3 sm:grid-cols-[1fr_170px_1fr_auto] sm:items-start">
                    <Input
                      aria-label="New milestone title"
                      placeholder="Title"
                      value={newMile.title}
                      onChange={(e) => setNewMile((s) => ({ ...s, title: e.target.value }))}
                      className="h-9 rounded-lg bg-white"
                    />
                    <Input
                      aria-label="New milestone date"
                      type="date"
                      value={newMile.date}
                      onChange={(e) => setNewMile((s) => ({ ...s, date: e.target.value }))}
                      className="h-9 rounded-lg bg-white"
                    />
                    <Input
                      aria-label="New milestone note"
                      placeholder="Note (optional)"
                      value={newMile.note}
                      onChange={(e) => setNewMile((s) => ({ ...s, note: e.target.value }))}
                      className="h-9 rounded-lg bg-white"
                    />
                    <Button
                      size="sm"
                      className="h-9 rounded-lg px-4 font-semibold"
                      disabled={mileBusy}
                      onClick={addMilestoneNow}
                    >
                      {mileBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                      Add
                    </Button>
                    {mileErr ? (
                      <p className="text-xs font-medium text-danger sm:col-span-4">{mileErr}</p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-20 -mx-5 mt-8 border-t border-up-border bg-white/95 px-5 py-4 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={goBack}
            className="h-10 rounded-xl font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Button>

          <div className="hidden items-center gap-1.5 sm:flex lg:hidden" aria-hidden>
            {STEPS.map((s) => (
              <span
                key={s.n}
                className={cn(
                  "size-1.5 rounded-full transition-all duration-200",
                  s.n === step
                    ? "w-5 bg-primary-500"
                    : s.n < step
                      ? "bg-primary-500/50"
                      : "bg-up-border-strong"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!editing ? (
              <Button
                variant="outline"
                onClick={saveDraft}
                disabled={saving !== ""}
                className="h-10 rounded-xl font-semibold"
              >
                {saving === "draft" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Save draft
              </Button>
            ) : null}
            {step < STEPS.length ? (
              <Button onClick={goNext} className="h-10 rounded-xl font-semibold">
                Continue
              </Button>
            ) : (
              <Button onClick={submitFinal} disabled={saving !== ""} className="h-10 rounded-xl font-semibold">
                {saving === "final" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {editing ? (publishNow ? "Publish project" : "Save changes") : "Publish project"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cover crop dialog */}
      <Dialog
        open={cropOpen}
        onOpenChange={(open) => {
          if (!open) closeCrop();
        }}
      >
        <DialogContent className="max-w-[min(672px,calc(100%-2rem))]!">
          <DialogHeader>
            <DialogTitle>Crop cover image</DialogTitle>
            <DialogDescription>
              Drag to reposition and zoom until the frame shows exactly what you want on the cover (16:9).
            </DialogDescription>
          </DialogHeader>

          <div className="relative h-64 w-full overflow-hidden rounded-xl border border-up-border bg-night sm:h-80">
            {cropSrc ? (
              <Cropper
                image={cropSrc}
                crop={cropPoint}
                zoom={cropZoom}
                aspect={COVER_ASPECT}
                onCropChange={setCropPoint}
                onZoomChange={setCropZoom}
                onCropComplete={(_area, pixels) => setCropArea(pixels)}
                objectFit="contain"
                showGrid
              />
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Slider
              aria-label="Zoom"
              value={[cropZoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={(v) => setCropZoom(v[0] ?? 1)}
              className="min-w-0 flex-1"
            />
            <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 rounded-lg font-semibold text-muted-foreground"
              onClick={() => {
                setCropZoom(1);
                setCropPoint({ x: 0, y: 0 });
              }}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Reset
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl font-semibold text-muted-foreground"
              onClick={closeCrop}
              disabled={cropBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl font-semibold"
              onClick={applyCrop}
              disabled={cropBusy || !cropArea}
            >
              {cropBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crop className="size-4" aria-hidden />}
              {cropBusy ? "Uploading…" : "Crop & upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

