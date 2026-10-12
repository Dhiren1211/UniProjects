"use client";

import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Bell,
  BellRing,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileQuestion,
  FileText,
  Flag,
  Github,
  Globe,
  Heart,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Presentation,
  Search,
  Send,
  Share2,
  Trash2,
  UserRound,
  UserRoundPlus,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { accentOf } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  addComment,
  addMember,
  addResource,
  addTimelineItem,
  cancelJoinRequest,
  deleteProject,
  deleteResource,
  deleteTimelineItem,
  fetchProject,
  fetchProjects,
  fileReport,
  removeMember,
  requestToJoin,
  requestVerification,
  searchUsers,
  setProjectStatus,
  toggleBookmark,
  toggleFollow,
  toggleLike,
  updateMember,
  uploadFile,
  type CommentDTO,
  type MemberDTO,
  type Navigate,
  type ProjectDetail,
  type ProjectDetailResponse,
  type ProjectListItem,
  type ResourceDTO,
  type SafeUserDTO,
  type TimelineDTO,
} from "../api-client";
import { ProjectCard } from "../project-card";
import { requireAuth, useAppStore } from "../store";
import {
  CategoryIcon,
  EmptyState,
  FeaturedBadge,
  Lightbox,
  StaffBadge,
  StatusBadge,
  TeammateWantedChip,
  UserAvatar,
  VerifiedBadge,
  formatMonthYear,
  formatViews,
  timeAgo,
} from "../ui-bits";

// ---------- helpers ----------

const RESOURCE_META: Record<string, { icon: LucideIcon; label: string }> = {
  DEMO: { icon: Globe, label: "Live demo" },
  GITHUB: { icon: Github, label: "Repository" },
  DOCUMENT: { icon: FileText, label: "Document" },
  VIDEO: { icon: Video, label: "Video" },
  PRESENTATION: { icon: Presentation, label: "Slides" },
};

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  LEAD: "Lead",
  MEMBER: "Member",
};

const URL_RE = /^https?:\/\/\S+/i;

const RESOURCE_FILE_ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif";

/** Uppercase file extension of an /uploads/… URL, e.g. "PDF". */
function extOf(url: string) {
  const m = url.match(/\.([a-z0-9]{1,5})(?:[?#]|$)/i);
  return m ? m[1].toUpperCase() : "FILE";
}

/** Decoded basename of an /uploads/… path (falls back to the raw string). */
function uploadBaseName(url: string) {
  const last = url.split("/").pop() ?? url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function fmtDay(iso: string) {
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return "";
  }
}

function InfoRow({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

function SidebarCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-up-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function MemberRow({ member, onOpen }: { member: MemberDTO; onOpen: (username: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(member.username)}
      aria-label={`View profile: ${member.name}`}
      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors duration-200 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <UserAvatar name={member.name} avatarUrl={member.avatarUrl} ring={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {member.role === "OWNER" ? (
            <Crown className="size-3 text-warning" aria-hidden />
          ) : null}
          {ROLE_LABEL[member.role] ?? member.role}
        </p>
      </div>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
    </button>
  );
}

function ResourceRow({
  resource,
  canDelete,
  onDelete,
}: {
  resource: ResourceDTO;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  const meta = RESOURCE_META[resource.type] ?? RESOURCE_META.DEMO;
  const Icon = meta.icon;
  const uploaded = resource.url.startsWith("/uploads/");
  return (
    <li className="group flex items-center gap-3 rounded-xl border border-up-border bg-white px-3.5 py-2.5 transition-colors duration-200 hover:border-up-border-strong hover:bg-surface-muted/50">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-foreground/70">
        <Icon className="size-4" aria-hidden />
      </span>
      <a
        href={resource.url}
        {...(uploaded ? { download: "" } : { target: "_blank", rel: "noopener noreferrer" })}
        className="min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary-700">
          {resource.label}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {uploaded ? `Uploaded file · ${uploadBaseName(resource.url)}` : resource.url}
        </p>
      </a>
      {uploaded ? (
        <>
          <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {extOf(resource.url)}
          </span>
          <Download className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </>
      ) : (
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      )}
      {canDelete && onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete resource: ${resource.label}`}
          onClick={onDelete}
          className="size-9 shrink-0 rounded-lg text-muted-foreground hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      ) : null}
    </li>
  );
}

// ---------- gallery slider ----------

function ProjectGallery({ images }: { images: string[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const count = images.length;

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  return (
    <section className="rounded-2xl border border-up-border bg-card p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Project gallery
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {selected + 1}/{count}
        </span>
      </div>

      <div className="relative mt-4">
        <div className="overflow-hidden rounded-2xl border border-up-border bg-surface-muted" ref={emblaRef}>
          <div className="flex">
            {images.map((src, i) => (
              <div key={`${i}-${src}`} className="min-w-0 flex-[0_0_100%]">
                <button
                  type="button"
                  aria-label={`View photo ${i + 1} full size`}
                  onClick={() => setLightboxIndex(i)}
                  className="block w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="aspect-video">
                    <img
                      src={src}
                      alt={`Project photo ${i + 1} of ${count}`}
                      className="size-full object-contain"
                      draggable={false}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => emblaApi?.scrollPrev()}
              className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-up-border bg-white/70 text-foreground shadow-md backdrop-blur transition-colors hover:bg-white/90 hover:text-primary-700"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => emblaApi?.scrollNext()}
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-up-border bg-white/70 text-foreground shadow-md backdrop-blur transition-colors hover:bg-white/90 hover:text-primary-700"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {images.map((src, i) => (
            <button
              key={`dot-${i}-${src}`}
              type="button"
              aria-label={`Go to photo ${i + 1}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === selected ? "w-6 bg-primary" : "w-1.5 bg-up-border-strong hover:bg-muted-foreground/40"
              )}
            />
          ))}
        </div>
      ) : null}

      {lightboxIndex !== null ? (
        <Lightbox
          src={images[lightboxIndex]}
          alt={`Project photo ${lightboxIndex + 1} of ${count}`}
          onClose={() => setLightboxIndex(null)}
          onPrev={count > 1 ? () => setLightboxIndex((i) => ((i ?? 0) + count - 1) % count) : undefined}
          onNext={count > 1 ? () => setLightboxIndex((i) => ((i ?? 0) + 1) % count) : undefined}
        />
      ) : null}

      <div className="nice-scroll mt-4 flex gap-2.5 overflow-x-auto pb-1">
        {images.map((src, i) => (
          <button
            key={`thumb-${i}-${src}`}
            type="button"
            aria-label={`Show photo ${i + 1}`}
            aria-current={i === selected ? "true" : undefined}
            onClick={() => emblaApi?.scrollTo(i)}
            className={cn(
              "relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-muted transition-all duration-200",
              i === selected
                ? "ring-2 ring-primary-500 ring-offset-2 ring-offset-white"
                : "opacity-75 hover:opacity-100"
            )}
          >
            <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------- dialogs ----------

function JoinDialog({
  open,
  onOpenChange,
  slug,
  projectTitle,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  projectTitle: string;
  onSent: () => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    setBusy(true);
    requestToJoin(slug, message.trim() || undefined)
      .then(() => {
        toast.success("Request sent — the team will review it");
        onOpenChange(false);
        setMessage("");
        onSent();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Request failed"))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request to join</DialogTitle>
          <DialogDescription>
            Ask the team behind “{projectTitle}” to add you as a teammate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="join-msg">Message (optional)</Label>
          <Textarea
            id="join-msg"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell them what you'd bring to the project…"
            className="rounded-xl"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="rounded-xl font-semibold">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  targetId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetId: string;
}) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (reason.trim().length < 4) {
      setErr("Please describe the problem (at least a few words).");
      return;
    }
    setBusy(true);
    setErr(null);
    fileReport({ targetType: "PROJECT", targetId, reason: reason.trim() })
      .then(() => {
        toast.success("Report submitted — our moderators will take a look");
        onOpenChange(false);
        setReason("");
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Report failed"))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this project</DialogTitle>
          <DialogDescription>
            Flag inappropriate or inaccurate content for the moderation team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="report-reason">What's wrong?</Label>
          <Textarea
            id="report-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. This project isn't theirs / misleading links…"
            className="rounded-xl"
          />
          {err ? <p className="text-xs font-medium text-danger">{err}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="rounded-xl bg-danger font-semibold text-white hover:bg-danger/90"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Flag className="size-4" aria-hidden />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageTeamDialog({
  open,
  onOpenChange,
  slug,
  members,
  viewerUsername,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  members: MemberDTO[];
  viewerUsername: string;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [found, setFound] = useState<SafeUserDTO[] | null>(null);
  const [foundFor, setFoundFor] = useState("");
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [busyMember, setBusyMember] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MemberDTO | null>(null);

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

  const existing = new Set(
    members.map((m) => m.username.toLowerCase()).concat(viewerUsername.toLowerCase())
  );
  const ready = debounced.length >= 2 && foundFor === debounced;
  const visible = ready
    ? (found ?? []).filter((u) => !existing.has(u.username.toLowerCase()))
    : null;

  const changeRole = (m: MemberDTO, role: string) => {
    if (role === m.role) return;
    setBusyMember(m.id);
    updateMember(slug, { memberId: m.id, role })
      .then(() => {
        toast.success(`${m.name} is now ${ROLE_LABEL[role] ?? role.toLowerCase()}`);
        onChanged();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"))
      .finally(() => setBusyMember(null));
  };

  const confirmRemove = () => {
    if (!removing) return;
    const m = removing;
    setBusyMember(m.id);
    removeMember(slug, { memberId: m.id })
      .then(() => {
        toast.success(`${m.name} was removed from the team`);
        onChanged();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Remove failed"))
      .finally(() => {
        setBusyMember(null);
        setRemoving(null);
      });
  };

  const addUser = (u: SafeUserDTO) => {
    setBusyUser(u.id);
    addMember(slug, { username: u.username, role: roles[u.id] ?? "MEMBER" })
      .then(() => {
        toast.success(`${u.displayName} joined the team`);
        onChanged();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add teammate"))
      .finally(() => setBusyUser(null));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage team</DialogTitle>
          <DialogDescription>
            Change roles or remove teammates. The project owner role can't be reassigned.
          </DialogDescription>
        </DialogHeader>

        <div className="nice-scroll max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {/* current members */}
          <div className="divide-y divide-up-border rounded-xl border border-up-border bg-white px-3.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5">
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
                      onValueChange={(role) => changeRole(m, role)}
                      disabled={busyMember === m.id}
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${m.name} from the team`}
                          className="size-9 rounded-lg text-muted-foreground hover:text-danger"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {m.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            They'll be untagged from this project and lose team access.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={confirmRemove}
                            className="bg-danger text-white hover:bg-danger/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* add by username */}
          <div>
            <Label htmlFor="team-search">Add teammates</Label>
            <div className="relative mt-1.5">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="team-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or username…"
                className="h-10 rounded-xl bg-white pl-9"
                autoComplete="off"
              />
            </div>
            <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto nice-scroll">
              {visible === null ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  {debounced.length >= 2 ? "Searching…" : "Type at least 2 characters to search students."}
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
                    <Select
                      value={roles[u.id] ?? "MEMBER"}
                      onValueChange={(role) => setRoles((r) => ({ ...r, [u.id]: role }))}
                    >
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
                      disabled={busyUser === u.id}
                      onClick={() => addUser(u)}
                    >
                      {busyUser === u.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        "Add"
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourceDialog({
  open,
  onOpenChange,
  slug,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  onSaved: () => void;
}) {
  const [type, setType] = useState("DEMO");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setType("DEMO");
      setLabel("");
      setUrl("");
      setMode("link");
      setFileName(null);
      setPct(null);
      setErr(null);
    }
  };

  const switchMode = (m: "link" | "upload") => {
    if (m === mode) return;
    setMode(m);
    // a /uploads/… path is not a valid link — drop it on switch
    if (m === "link" && url.startsWith("/uploads/")) setUrl("");
  };

  const onFile = (file: File) => {
    setPct(0);
    uploadFile(file, "resource", setPct)
      .then((u) => {
        setUrl(u);
        setFileName(file.name);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Upload failed"))
      .finally(() => setPct(null));
  };

  const submit = () => {
    if (!label.trim()) {
      setErr("Give the resource a short label.");
      return;
    }
    if (mode === "upload") {
      if (!url.startsWith("/uploads/")) {
        setErr("Upload a file first.");
        return;
      }
    } else if (!URL_RE.test(url.trim())) {
      setErr("Enter a full URL starting with http:// or https://");
      return;
    }
    setBusy(true);
    setErr(null);
    addResource(slug, { type, label: label.trim(), url: url.trim() })
      .then(() => {
        toast.success("Resource added");
        close(false);
        onSaved();
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Could not add resource"))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add resource</DialogTitle>
          <DialogDescription>Links and uploaded files are shown on the project page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="res-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                if (v === "GITHUB" && mode === "upload") {
                  setMode("link");
                  if (url.startsWith("/uploads/")) setUrl("");
                }
              }}
            >
              <SelectTrigger id="res-type" className="h-10 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RESOURCE_META).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <div className="inline-flex items-center rounded-lg bg-surface-muted p-0.5" role="group" aria-label="Resource source">
              <button
                type="button"
                aria-pressed={mode === "link"}
                onClick={() => switchMode("link")}
                className={cn(
                  "rounded-[7px] px-3 py-1.5 text-xs font-semibold transition-colors duration-200",
                  mode === "link" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Link
              </button>
              <button
                type="button"
                aria-pressed={mode === "upload"}
                disabled={type === "GITHUB"}
                title={type === "GITHUB" ? "Repositories must be links" : undefined}
                onClick={() => switchMode("upload")}
                className={cn(
                  "rounded-[7px] px-3 py-1.5 text-xs font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
                  mode === "upload" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Upload
              </button>
            </div>
            {type === "GITHUB" ? (
              <p className="text-xs text-muted-foreground">Repositories must be links.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-label">Label</Label>
            <Input
              id="res-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Figma prototype"
              className="h-10 rounded-xl"
            />
          </div>
          {mode === "link" ? (
            <div className="space-y-1.5">
              <Label htmlFor="res-url">URL</Label>
              <Input
                id="res-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
                className="h-10 rounded-xl"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>File</Label>
              <input
                ref={fileRef}
                type="file"
                accept={RESOURCE_FILE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onFile(file);
                  e.target.value = "";
                }}
              />
              {url.startsWith("/uploads/") ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-up-border bg-surface-muted px-2.5 py-2 text-xs font-medium text-foreground">
                  <FileCheck2 className="size-3.5 shrink-0 text-success" aria-hidden />
                  <span className="truncate">{fileName ?? "Uploaded file"}</span>
                  <Check className="size-3.5 shrink-0 text-success" aria-hidden />
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl font-semibold"
                  disabled={pct !== null}
                  onClick={() => fileRef.current?.click()}
                >
                  {pct !== null ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Paperclip className="size-4" aria-hidden />
                  )}
                  {pct !== null ? `Uploading ${pct}%` : "Choose file"}
                </Button>
              )}
              {pct !== null ? (
                <div
                  className="h-1 w-full max-w-56 overflow-hidden rounded-full bg-surface-muted"
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
          )}
          {err ? <p className="text-xs font-medium text-danger">{err}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || pct !== null} className="rounded-xl font-semibold">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Add resource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MilestoneDialog({
  open,
  onOpenChange,
  slug,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setTitle("");
      setDate("");
      setNote("");
      setErr(null);
    }
  };

  const submit = () => {
    if (!title.trim()) {
      setErr("Give the milestone a title.");
      return;
    }
    if (!date) {
      setErr("Pick a date.");
      return;
    }
    setBusy(true);
    setErr(null);
    addTimelineItem(slug, { title: title.trim(), date, note: note.trim() || undefined })
      .then(() => {
        toast.success("Milestone added");
        close(false);
        onSaved();
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Could not add milestone"))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add milestone</DialogTitle>
          <DialogDescription>Mark a moment on the project timeline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mile-title">Title</Label>
            <Input
              id="mile-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mid-term demo day"
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mile-date">Date</Label>
            <Input
              id="mile-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mile-note">Note (optional)</Label>
            <Textarea
              id="mile-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="One line about what happened…"
              className="rounded-xl"
            />
          </div>
          {err ? <p className="text-xs font-medium text-danger">{err}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="rounded-xl font-semibold">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            Add milestone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- view ----------

export function DetailView({ slug, navigate }: { slug: string; navigate: Navigate }) {
  const { user, openAuth } = useAppStore();
  const [data, setData] = useState<ProjectDetailResponse | null>(null);
  const [comments, setComments] = useState<CommentDTO[] | null>(null);
  const [related, setRelated] = useState<ProjectListItem[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  const [joinOpen, setJoinOpen] = useState(false);
  const [coverLbOpen, setCoverLbOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchProject(slug, ac.signal)
      .then((res) => {
        setData(res);
        setComments(res.project.comments);
        setNotFound(false);
        setFailed(false);
        // related projects from the same department
        return fetchProjects({ dept: res.project.department.code, limit: 7 }, ac.signal)
          .then((rows) => setRelated(rows.filter((r) => r.slug !== res.project.slug).slice(0, 3)))
          .catch(() => setRelated([]));
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        const msg = e instanceof Error ? e.message : "";
        if (msg === "Project not found") setNotFound(true);
        else setFailed(true);
      });
    return () => ac.abort();
  }, [slug, user?.id, retry]);

  if (notFound) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-24 md:px-8">
        <EmptyState
          icon={FileQuestion}
          title="Project not found"
          hint="This project may have been removed, or the link is incorrect."
          action={
            <Button onClick={() => navigate({ name: "projects" })} className="rounded-xl font-semibold">
              Browse all projects
            </Button>
          }
        />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-24 md:px-8">
        <EmptyState
          icon={AlertTriangle}
          title="Something went wrong"
          hint="We couldn't load this project. Check your connection and try again."
          action={
            <Button onClick={() => setRetry((r) => r + 1)} variant="outline" className="rounded-xl font-semibold">
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <div className="h-44 animate-pulse rounded-3xl border border-up-border bg-surface-muted" />
        <div className="mt-8 space-y-4">
          <div className="h-9 w-2/3 animate-pulse rounded-lg bg-surface-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface-muted" />
          <div className="h-40 w-full animate-pulse rounded-2xl border border-up-border bg-surface-muted" />
        </div>
      </div>
    );
  }

  const project = data.project;
  const viewer = data.viewer;
  const isOwner = viewer.isOwner;
  const isMember = viewer.isMember;
  const accent = accentOf(project.department.accent);

  const refresh = () => setRetry((r) => r + 1);

  const patchViewer = (patch: Partial<typeof viewer>) =>
    setData((d) => (d ? { ...d, viewer: { ...d.viewer, ...patch } } : d));
  const patchProject = (patch: Partial<ProjectDetail>) =>
    setData((d) => (d ? { ...d, project: { ...d.project, ...patch } } : d));

  // ---------- actions ----------

  const onBookmark = () => {
    if (!requireAuth(user, openAuth) || !data) return;
    const next = !data.viewer.bookmarked;
    patchViewer({ bookmarked: next });
    toggleBookmark({ targetType: "PROJECT", targetId: project.id })
      .then((res) => patchViewer({ bookmarked: res.active }))
      .catch(() => {
        patchViewer({ bookmarked: !next });
        toast.error("Couldn't update your library");
      });
  };

  const onFollow = () => {
    if (!requireAuth(user, openAuth) || !data) return;
    const next = !data.viewer.following;
    patchViewer({ following: next });
    toggleFollow({ targetType: "PROJECT", targetId: project.id })
      .then((res) => patchViewer({ following: res.active }))
      .catch(() => {
        patchViewer({ following: !next });
        toast.error("Couldn't update follow");
      });
  };

  const onLike = () => {
    if (!requireAuth(user, openAuth) || !data) return;
    const next = !data.viewer.liked;
    const prevCount = project.likeCount;
    patchViewer({ liked: next });
    patchProject({ likeCount: Math.max(0, prevCount + (next ? 1 : -1)) });
    toggleLike({ targetType: "PROJECT", targetId: project.id })
      .then((res) => patchViewer({ liked: res.active }))
      .catch(() => {
        patchViewer({ liked: !next });
        patchProject({ likeCount: prevCount });
        toast.error("Couldn't update like");
      });
  };

  const onShare = () => {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success("Link copied"))
        .catch(() => toast.error("Couldn't copy the link"));
    } else {
      toast.error("Couldn't copy the link");
    }
  };

  const onJoinClick = () => {
    if (!requireAuth(user, openAuth) || !data) return;
    setJoinOpen(true);
  };

  const onCancelJoin = () => {
    if (!requireAuth(user, openAuth) || !data) return;
    setJoinBusy(true);
    cancelJoinRequest(slug)
      .then(() => {
        toast.success("Join request cancelled");
        refresh();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't cancel request"))
      .finally(() => setJoinBusy(false));
  };

  const onStatusChange = (status: string) => {
    const next = status as "DRAFT" | "PUBLISHED";
    if (next === project.status) return;
    setProjectStatus(slug, next)
      .then(() => {
        toast.success(next === "PUBLISHED" ? "Project is now live" : "Project moved to drafts");
        refresh();
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't update status"));
  };

  const onVerifyRequest = () => {
    requestVerification(slug)
      .then(() => toast.success("Verification requested — faculty will review it"))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Request failed"));
  };

  const onDelete = () => {
    deleteProject(slug)
      .then(() => {
        toast.success("Project deleted");
        navigate({ name: "projects" });
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"));
  };

  const onResourceDelete = (r: ResourceDTO) => {
    deleteResource(slug, r.id)
      .then(() => {
        toast.success("Resource removed");
        patchProject({ resources: project.resources.filter((x) => x.id !== r.id) });
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"));
  };

  const onMilestoneDelete = (t: TimelineDTO) => {
    deleteTimelineItem(slug, t.id)
      .then(() => {
        toast.success("Milestone removed");
        patchProject({ timeline: project.timeline.filter((x) => x.id !== t.id) });
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"));
  };

  const onCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = commentDraft.trim();
    if (!body || commentBusy) return;
    setCommentBusy(true);
    addComment(slug, body)
      .then((c) => {
        setComments((prev) => [c, ...(prev ?? [])]);
        setCommentDraft("");
        toast.success("Comment posted");
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Couldn't post comment"))
      .finally(() => setCommentBusy(false));
  };

  const toggleBtn = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      active
        ? "border-primary-200 bg-primary-50 text-primary-700"
        : "border-up-border bg-white text-foreground hover:border-up-border-strong hover:shadow-sm"
    );

  const showJoin =
    !isOwner && !isMember && project.allowJoinRequests && viewer.joinRequestStatus !== "APPROVED";

  return (
    <article className="mx-auto w-full max-w-6xl px-5 py-8 pb-20 md:px-8 md:py-12">
      {/* Back */}
      <Button
        variant="ghost"
        onClick={() => navigate({ name: "projects" })}
        className="-ml-2 h-9 rounded-lg text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All projects
      </Button>

      {/* Banner */}
      {project.coverImage ? (
        <div className="relative mt-4 h-56 overflow-hidden rounded-3xl border border-up-border bg-gradient-to-br sm:h-64 md:h-72">
          <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-br", accent.cover)} />
          <img
            src={project.coverImage}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="absolute inset-0 size-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent"
          />
          {project.featured ? (
            <span className="absolute left-4 top-4 z-20">
              <FeaturedBadge />
            </span>
          ) : null}
          <span className="absolute right-4 top-4 z-20 flex items-center gap-2">
            {project.verified ? <VerifiedBadge /> : null}
            <span
              className={cn(
                "rounded-full border bg-white/90 px-3 py-1 text-xs font-semibold shadow-sm",
                accent.chip
              )}
            >
              {project.department.code}
            </span>
          </span>
          <button
            type="button"
            aria-label="View cover image full size"
            onClick={() => setCoverLbOpen(true)}
            className="absolute inset-0 z-10 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ) : (
        <div
          className={cn(
            "relative mt-4 flex h-40 items-center justify-center overflow-hidden rounded-3xl border border-up-border bg-gradient-to-br md:h-52",
            accent.cover
          )}
        >
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white/70 text-foreground/60 shadow-sm">
            <CategoryIcon category={project.category} className="size-7" />
          </span>
          {project.featured ? (
            <span className="absolute left-4 top-4">
              <FeaturedBadge />
            </span>
          ) : null}
          <span className="absolute right-4 top-4 flex items-center gap-2">
            {project.verified ? <VerifiedBadge /> : null}
            <span
              className={cn(
                "rounded-full border bg-white/85 px-3 py-1 text-xs font-semibold shadow-sm",
                accent.chip
              )}
            >
              {project.department.code}
            </span>
          </span>
        </div>
      )}

      {/* Header */}
      <header className="mt-8 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className={cn("rounded-full border px-2.5 py-1", accent.chip)}>
            {project.department.name}
          </span>
          <span className="rounded-full border border-up-border bg-white px-2.5 py-1 text-muted-foreground">
            {project.category}
          </span>
          <span className="rounded-full border border-up-border bg-white px-2.5 py-1 text-muted-foreground">
            {project.year} · {project.semester}
          </span>
          {project.status === "DRAFT" ? <StatusBadge status={project.status} /> : null}
          {project.lookingForTeammates ? <TeammateWantedChip /> : null}
        </div>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
          {project.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground md:text-lg">
          {project.summary}
        </p>

        {/* Meta */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {project.supervisor ? <InfoRow icon={UserRound}>{project.supervisor}</InfoRow> : null}
          <InfoRow icon={Users}>{project.members.length} members</InfoRow>
          <InfoRow icon={Eye}>{formatViews(project.views)} views</InfoRow>
          <InfoRow icon={Heart}>
            {project.likeCount} {project.likeCount === 1 ? "like" : "likes"}
          </InfoRow>
          <InfoRow icon={CalendarDays}>Added {formatMonthYear(project.createdAt)}</InfoRow>
        </div>

        {/* Action rows — primary (open / join) + secondary (save · follow · like · share · report) */}
        <div className="mt-6 flex flex-col gap-2.5">
          {project.demoUrl || project.repoUrl || showJoin ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {project.demoUrl ? (
                <Button asChild className="h-9 rounded-xl font-semibold">
                  <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                    <Globe className="size-4" aria-hidden />
                    Open demo
                    <ExternalLink className="size-3.5 opacity-60" aria-hidden />
                  </a>
                </Button>
              ) : null}
              {project.repoUrl ? (
                <Button asChild variant="outline" className="h-9 rounded-xl font-semibold">
                  <a href={project.repoUrl} target="_blank" rel="noopener noreferrer">
                    <Github className="size-4" aria-hidden />
                    View repository
                    <ExternalLink className="size-3.5 opacity-60" aria-hidden />
                  </a>
                </Button>
              ) : null}
              {showJoin ? (
                viewer.joinRequestStatus === "PENDING" ? (
                  <>
                    <Button variant="outline" disabled className="h-9 rounded-xl font-semibold">
                      <Clock className="size-4" aria-hidden />
                      Request pending
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={onCancelJoin}
                      disabled={joinBusy}
                      className="h-9 rounded-xl text-muted-foreground hover:bg-surface-muted hover:text-danger"
                    >
                      <X className="size-4" aria-hidden />
                      Cancel request
                    </Button>
                  </>
                ) : (
                  <Button onClick={onJoinClick} className="h-9 rounded-xl font-semibold">
                    <UserRoundPlus className="size-4" aria-hidden />
                    Request to join
                  </Button>
                )
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={onBookmark} aria-pressed={viewer.bookmarked} className={toggleBtn(viewer.bookmarked)}>
              {viewer.bookmarked ? (
                <BookmarkCheck className="size-4 fill-current" aria-hidden />
              ) : (
                <Bookmark className="size-4" aria-hidden />
              )}
              {viewer.bookmarked ? "Saved" : "Save"}
            </button>

            <button type="button" onClick={onFollow} aria-pressed={viewer.following} className={toggleBtn(viewer.following)}>
              {viewer.following ? (
                <BellRing className="size-4" aria-hidden />
              ) : (
                <Bell className="size-4" aria-hidden />
              )}
              {viewer.following ? "Following" : "Follow"}
            </button>

            <button type="button" onClick={onLike} aria-pressed={viewer.liked} className={cn(toggleBtn(viewer.liked), viewer.liked && "border-danger/30 bg-danger-soft text-danger")}>
              <Heart className={cn("size-4", viewer.liked && "fill-current")} aria-hidden />
              <span className="tabular-nums">{project.likeCount}</span>
              <span className="sr-only">likes — {viewer.liked ? "liked" : "like this project"}</span>
            </button>

            <button type="button" onClick={onShare} className={toggleBtn(false)}>
              <Share2 className="size-4" aria-hidden />
              Share
            </button>

            <Button
              variant="ghost"
              onClick={() => {
                if (!requireAuth(user, openAuth)) return;
                setReportOpen(true);
              }}
              className="h-9 rounded-xl text-muted-foreground hover:bg-surface-muted hover:text-danger"
            >
              <Flag className="size-4" aria-hidden />
              Report
            </Button>
          </div>
        </div>
      </header>

      {/* Owner / staff tools */}
      {isOwner ? (
        <section
          aria-label="Owner tools"
          className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-primary-100 bg-primary-50/50 p-4"
        >
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary-700">
            <Pencil className="size-3.5" aria-hidden />
            Owner tools
          </span>
          <Button
            variant="outline"
            onClick={() => navigate({ name: "create", editSlug: slug })}
            className="h-9 rounded-lg bg-white font-semibold"
          >
            <Pencil className="size-4" aria-hidden />
            Edit project
          </Button>
          <Button
            variant="outline"
            onClick={() => setTeamOpen(true)}
            className="h-9 rounded-lg bg-white font-semibold"
          >
            <Users className="size-4" aria-hidden />
            Manage team
          </Button>
          <Select value={project.status} onValueChange={onStatusChange}>
            <SelectTrigger
              aria-label="Project status"
              className="h-9 w-[150px] rounded-lg border-up-border bg-white"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Draft — hidden</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
            </SelectContent>
          </Select>
          {project.verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
              <BadgeCheck className="size-3.5" aria-hidden />
              Verified by faculty
            </span>
          ) : (
            <Button
              variant="outline"
              onClick={onVerifyRequest}
              className="h-9 rounded-lg bg-white font-semibold"
            >
              <BadgeCheck className="size-4" aria-hidden />
              Request verification
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="ml-auto h-9 rounded-lg border-danger/30 bg-white font-semibold text-danger hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" aria-hidden />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{project.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the project, its team, resources and discussion. This
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-danger text-white hover:bg-danger/90">
                  Delete project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      ) : null}

      {/* Body */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {/* About */}
          <section className="rounded-2xl border border-up-border bg-card p-6 md:p-8">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              About the project
            </h2>
            <div className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">
              {project.description}
            </div>

            {/* Built with — technologies used */}
            {project.technologies.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Built with
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.technologies.map((t) => (
                    <span
                      key={t.id}
                      className="rounded-full border border-up-border bg-white px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {project.tags.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-up-border pt-5">
                {project.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary-50 hover:text-primary-700"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {/* Gallery */}
          {project.galleryImages.length > 0 ? <ProjectGallery images={project.galleryImages} /> : null}

          {/* Resources */}
          {project.resources.length > 0 || isOwner ? (
            <section className="rounded-2xl border border-up-border bg-card p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Resources
                </h2>
                {isOwner ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResourceOpen(true)}
                    className="h-8 rounded-lg font-semibold"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add
                  </Button>
                ) : null}
              </div>
              {project.resources.length > 0 ? (
                <ul className="mt-3.5 space-y-2">
                  {project.resources.map((r) => (
                    <ResourceRow key={r.id} resource={r} canDelete={isOwner} onDelete={() => onResourceDelete(r)} />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No resources yet{isOwner ? " — add a demo, repo, docs or slides." : "."}
                </p>
              )}
            </section>
          ) : null}

          {/* Timeline */}
          {project.timeline.length > 0 || isOwner ? (
            <section className="rounded-2xl border border-up-border bg-card p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Timeline
                </h2>
                {isOwner ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMilestoneOpen(true)}
                    className="h-8 rounded-lg font-semibold"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add milestone
                  </Button>
                ) : null}
              </div>
              {project.timeline.length > 0 ? (
                <ol className="relative ml-1 mt-5 space-y-6 border-l-2 border-up-border pl-6">
                  {project.timeline.map((t) => (
                    <li key={t.id} className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-[31px] top-1 size-2.5 rounded-full bg-primary-500 ring-4 ring-white"
                      />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{t.title}</p>
                          <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                            {fmtDay(t.date)}
                          </p>
                          {t.note ? (
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              {t.note}
                            </p>
                          ) : null}
                        </div>
                        {isOwner ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete milestone: ${t.title}`}
                            onClick={() => onMilestoneDelete(t)}
                            className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-danger"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No milestones yet{isOwner ? " — add the first one." : "."}
                </p>
              )}
            </section>
          ) : null}

          {/* Discussion */}
          <section className="rounded-2xl border border-up-border bg-card p-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Discussion
              </h2>
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                {comments?.length ?? 0}
              </span>
            </div>

            {user ? (
              <form onSubmit={onCommentSubmit} className="mt-4">
                <Textarea
                  aria-label="Write a comment"
                  rows={3}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Share feedback or ask the team a question…"
                  className="rounded-xl"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={commentBusy || !commentDraft.trim()}
                    className="h-9 rounded-xl font-semibold"
                  >
                    {commentBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-4" aria-hidden />
                    )}
                    Post comment
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted px-4 py-3.5">
                <p className="text-sm text-muted-foreground">Sign in to join the discussion.</p>
                <Button
                  size="sm"
                  onClick={() => openAuth("login")}
                  className="h-9 rounded-lg px-4 font-semibold"
                >
                  Sign in
                </Button>
              </div>
            )}

            <ul className="mt-5 divide-y divide-up-border">
              {(comments ?? []).map((c) => (
                <li key={c.id} className="flex gap-3 py-4 first:pt-0">
                  <UserAvatar name={c.user.displayName} avatarUrl={c.user.avatarUrl} ring={false} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-foreground">{c.user.displayName}</p>
                      <StaffBadge role={c.user.role} />
                      <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {comments !== null && comments.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No comments yet — start the conversation.
              </p>
            ) : null}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4">
          <SidebarCard title={`Team · ${project.members.length}`}>
            <div className="space-y-1">
              {project.members.map((m) => (
                <MemberRow key={m.id} member={m} onOpen={(username) => navigate({ name: "profile", username })} />
              ))}
            </div>
          </SidebarCard>

          {project.supervisor ? (
            <SidebarCard title="Supervisor">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                  <UserRound className="size-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{project.supervisor}</p>
                  <p className="text-xs text-muted-foreground">Project supervisor</p>
                </div>
              </div>
            </SidebarCard>
          ) : null}

          <SidebarCard title="Department">
            <p className="text-sm font-medium text-foreground">{project.department.name}</p>
            {project.department.tagline ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {project.department.tagline}
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 h-8 w-full rounded-lg font-semibold"
              onClick={() => navigate({ name: "projects", dept: project.department.code })}
            >
              View department projects
            </Button>
          </SidebarCard>
        </aside>
      </div>

      {/* Related */}
      <section className="mt-14">
        {related === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-60 animate-pulse rounded-2xl border border-up-border bg-surface-muted" />
            ))}
          </div>
        ) : related.length > 0 ? (
          <>
            <h2 className="text-lg font-bold tracking-tight text-foreground md:text-xl">
              More from {project.department.name}
            </h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={(s) => navigate({ name: "project", slug: s })} />
              ))}
            </div>
          </>
        ) : null}
      </section>

      {/* Dialogs */}
      <JoinDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        slug={slug}
        projectTitle={project.title}
        onSent={refresh}
      />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetId={project.id} />
      <ManageTeamDialog
        open={teamOpen}
        onOpenChange={setTeamOpen}
        slug={slug}
        members={project.members}
        viewerUsername={viewer.user?.username ?? ""}
        onChanged={refresh}
      />
      <ResourceDialog open={resourceOpen} onOpenChange={setResourceOpen} slug={slug} onSaved={refresh} />
      <MilestoneDialog open={milestoneOpen} onOpenChange={setMilestoneOpen} slug={slug} onSaved={refresh} />

      {coverLbOpen && project.coverImage ? (
        <Lightbox
          src={project.coverImage}
          alt={`Cover of ${project.title}`}
          onClose={() => setCoverLbOpen(false)}
        />
      ) : null}
    </article>
  );
}
