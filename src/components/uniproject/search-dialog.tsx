"use client";

// ============================================================
// SearchDialog — command-palette style global search.
// ⌘K / Ctrl+K opens it from anywhere, ↑↓ + Enter navigate
// results (projects · people · posts), quick-destination
// tiles when empty, and a keyboard hint bar at the bottom.
// ============================================================

import { useEffect, useRef, useState } from "react";
import {
  FileText,
  FolderKanban,
  Loader2,
  MessagesSquare,
  Search,
  SearchX,
  SquarePlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  globalSearch,
  type Navigate,
  type PostDTO,
  type ProjectListItem,
  type SafeUserDTO,
} from "./api-client";
import { CategoryIcon, MemberAvatar, formatViews } from "./ui-bits";
import { requireAuth, useAppStore } from "./store";

type Row =
  | { kind: "project"; p: ProjectListItem }
  | { kind: "user"; u: SafeUserDTO }
  | { kind: "post"; p: PostDTO }
  | {
      kind: "quick";
      label: string;
      sub: string;
      icon: LucideIcon;
      target: "projects" | "community" | "students" | "submit";
    };

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-up-border bg-background px-1 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function SearchDialog({ navigate }: { navigate: Navigate }) {
  const { searchOpen, setSearchOpen } = useAppStore();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{
    projects: ProjectListItem[];
    users: SafeUserDTO[];
    posts: PostDTO[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const acRef = useRef<AbortController | null>(null);

  const resetSelection = () => setActive(0);

  // ⌘K / Ctrl+K opens the palette from anywhere (unless a modal is already up)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const { searchOpen: open, authModal, setSearchOpen: setOpen } = useAppStore.getState();
        if (open || authModal) return;
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // debounced search while the dialog is open
  useEffect(() => {
    if (!searchOpen || q.trim().length < 2) return;
    const t = setTimeout(() => {
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;
      setLoading(true);
      globalSearch(q.trim(), ac.signal)
        .then((r) => {
          setResults(r);
          resetSelection();
        })
        .catch(() => {
          if (!ac.signal.aborted) {
            setResults(null);
            resetSelection();
          }
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [q, searchOpen]);

  const query = q.trim();
  const showing = query.length >= 2 ? results : null;
  const hasResults =
    !!showing && (showing.projects.length > 0 || showing.users.length > 0 || showing.posts.length > 0);

  const go = (fn: () => void) => {
    acRef.current?.abort();
    setSearchOpen(false);
    setQ("");
    setResults(null);
    resetSelection();
    fn();
  };

  const submitProject = () => {
    const { user, openAuth } = useAppStore.getState();
    // close the palette first — the auth modal (or create view) takes over cleanly
    go(() => {
      if (!requireAuth(user, openAuth)) return;
      navigate({ name: "create" });
    });
  };

  // rows currently under keyboard control: results, or the quick tiles when idle
  const rows: Row[] = hasResults
    ? [
        ...showing!.projects.map((p) => ({ kind: "project", p }) as Row),
        ...showing!.users.map((u) => ({ kind: "user", u }) as Row),
        ...showing!.posts.map((p) => ({ kind: "post", p }) as Row),
      ]
    : query.length < 2
      ? [
          {
            kind: "quick",
            label: "All projects",
            sub: "Browse every showcase entry",
            icon: FolderKanban,
            target: "projects",
          },
          {
            kind: "quick",
            label: "Community board",
            sub: "Team-up posts and campus chatter",
            icon: MessagesSquare,
            target: "community",
          },
          {
            kind: "quick",
            label: "Student directory",
            sub: "Find makers and teammates",
            icon: Users,
            target: "students",
          },
          {
            kind: "quick",
            label: "Submit a project",
            sub: "Put your build on the stage",
            icon: SquarePlus,
            target: "submit",
          },
        ]
      : [];

  // (keyboard selection resets live in the input onChange + search callbacks —
  //  no effect needed, which also keeps the react-hooks rules happy)

  // keep the active row in view
  useEffect(() => {
    const el = document.querySelector('[data-palette-row][data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active, rows.length]);

  const runRow = (r: Row) => {
    if (r.kind === "project") go(() => navigate({ name: "project", slug: r.p.slug }));
    else if (r.kind === "user") go(() => navigate({ name: "profile", username: r.u.username }));
    else if (r.kind === "post") go(() => navigate({ name: "community" }));
    else {
      // quick destination tile
      const { target } = r;
      if (target === "submit") {
        submitProject();
      } else {
        go(() => navigate({ name: target }));
      }
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      const r = rows[active];
      if (r) {
        e.preventDefault();
        runRow(r);
      }
    }
  };

  const rowCls = (i: number) =>
    `flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
      i === active ? "bg-surface-muted" : "hover:bg-surface-muted/70"
    }`;

  const sectionCls = "px-1 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500";

  return (
    <Dialog open={searchOpen} onOpenChange={(v) => { setSearchOpen(v); if (!v) { setQ(""); setResults(null); resetSelection(); } }}>
      <DialogContent
        showCloseButton={false}
        className="top-[8%] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl sm:top-[10%]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search the showcase</DialogTitle>
          <DialogDescription>Search projects, people, and posts</DialogDescription>
        </DialogHeader>

        {/* input row */}
        <div className="flex items-center gap-3 border-b border-up-border px-4">
          <Search
            className={`size-[18px] shrink-0 transition-colors ${query ? "text-primary" : "text-muted-foreground"}`}
            aria-hidden
          />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetSelection();
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search projects, people, posts…"
            aria-label="Search query"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="search-palette-rows"
            aria-activedescendant={rows[active] ? `search-row-${active}` : undefined}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Kbd>esc</Kbd>
          )}
        </div>

        {/* body */}
        <div id="search-palette-rows" role="listbox" aria-label="Search results" className="nice-scroll max-h-[min(23rem,52vh)] overflow-y-auto px-2 pb-2">
          {/* idle → quick destinations */}
          {query.length < 2 ? (
            <div className="grid gap-2 p-1.5 sm:grid-cols-2">
              {rows.map((r, i) => {
                if (r.kind !== "quick") return null;
                const Icon = r.icon;
                return (
                  <button
                    key={r.label}
                    id={`search-row-${i}`}
                    data-palette-row
                    data-active={i === active}
                    role="option"
                    aria-selected={i === active}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => runRow(r)}
                    className="group flex items-start gap-3 rounded-xl border border-up-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-50/50 data-[active=true]:border-primary/40 data-[active=true]:bg-primary-50/60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-100">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{r.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{r.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* searching but nothing found */}
          {!hasResults && query.length >= 2 && !loading ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                <SearchX className="size-4.5" aria-hidden />
              </span>
              <p className="text-sm font-medium">Nothing found for “{query}”</p>
              <p className="text-xs text-muted-foreground">
                Try a project name, a student, or a topic like “IoT”.
              </p>
            </div>
          ) : null}

          {/* projects */}
          {hasResults && showing!.projects.length > 0 ? (
            <div>
              <p className={sectionCls}>Projects · {showing!.projects.length}</p>
              {showing!.projects.map((p, i) => (
                <button
                  key={p.slug}
                  id={`search-row-${i}`}
                  data-palette-row
                  data-active={i === active}
                  role="option"
                  aria-selected={i === active}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => runRow({ kind: "project", p })}
                  className={rowCls(i)}
                >
                  {p.coverImage ? (
                    <img
                      src={p.coverImage}
                      alt=""
                      className="size-9 shrink-0 rounded-lg border border-up-border object-cover"
                    />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-foreground/60">
                      <CategoryIcon category={p.category} className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.category} · {p.year}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-500">
                    {formatViews(p.views)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {/* people */}
          {hasResults && showing!.users.length > 0 ? (
            <div>
              <p className={sectionCls}>People · {showing!.users.length}</p>
              {showing!.users.map((u, i) => {
                const idx = showing!.projects.length + i;
                return (
                  <button
                    key={u.username}
                    id={`search-row-${idx}`}
                    data-palette-row
                    data-active={idx === active}
                    role="option"
                    aria-selected={idx === active}
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => runRow({ kind: "user", u })}
                    className={rowCls(idx)}
                  >
                    {u.avatarUrl ? (
                      <img
                        src={u.avatarUrl}
                        alt=""
                        className="size-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <MemberAvatar name={u.displayName} ring={false} className="size-9" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{u.displayName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        @{u.username}
                        {u.department ? ` · ${u.department.code}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* posts */}
          {hasResults && showing!.posts.length > 0 ? (
            <div>
              <p className={sectionCls}>Posts · {showing!.posts.length}</p>
              {showing!.posts.map((p, i) => {
                const idx = showing!.projects.length + showing!.users.length + i;
                return (
                  <button
                    key={p.id}
                    id={`search-row-${idx}`}
                    data-palette-row
                    data-active={idx === active}
                    role="option"
                    aria-selected={idx === active}
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => runRow({ kind: "post", p })}
                    className={`${rowCls(idx)} items-start`}
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-foreground/60">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{p.user.displayName}</span>
                      <span className="line-clamp-2 block text-xs leading-snug text-muted-foreground">
                        {p.body}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* keyboard hint bar */}
        <div className="flex items-center gap-4 border-t border-up-border bg-surface-muted/60 px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navigate
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            open
          </span>
          <span className="ml-auto hidden items-center gap-1.5 sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            from anywhere
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
