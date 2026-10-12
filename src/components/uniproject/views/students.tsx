"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  fetchDepartments,
  fetchStudents,
  type DepartmentDTO,
  type Navigate,
  type UserDirectoryEntry,
} from "../api-client";
import { CardSkeletonGrid, EmptyState, StaffBadge, TeammateWantedChip, UserAvatar } from "../ui-bits";

export function StudentsView({ navigate }: { navigate: Navigate }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [dept, setDept] = useState("");
  const [teammates, setTeammates] = useState(false);
  const [sort, setSort] = useState("projects");

  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [people, setPeople] = useState<UserDirectoryEntry[] | null>(null); // null = loading
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // departments are static — load once
  useEffect(() => {
    const ac = new AbortController();
    fetchDepartments(ac.signal)
      .then(setDepartments)
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // directory listing
  useEffect(() => {
    const ac = new AbortController();
    fetchStudents(
      {
        query: debouncedQ || undefined,
        dept: dept || undefined,
        teammates: teammates ? "1" : undefined,
        sort,
      },
      ac.signal
    )
      .then((rows) => {
        setPeople(rows);
        setError(false);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setPeople([]);
        setError(true);
      });
    return () => ac.abort();
  }, [debouncedQ, dept, teammates, sort, retry]);

  const loading = people === null;
  const count = people?.length ?? 0;

  const hasFilters = Boolean(debouncedQ || dept || teammates);
  const clearFilters = () => {
    setQ("");
    setDept("");
    setTeammates(false);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 pb-20 md:px-8 md:py-14">
      {/* Heading */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Students &amp; faculty
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base" aria-live="polite">
          {loading
            ? "Loading people…"
            : error
              ? "Something went wrong while loading."
              : `${count} ${count === 1 ? "person" : "people"} on campus`}
        </p>
      </header>

      {/* Controls */}
      <div className="mt-8 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              aria-label="Search people"
              placeholder="Search by name, username, program, or skill…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 rounded-xl bg-white pl-10"
            />
          </div>

          {/* Department */}
          <Select value={dept || "__all__"} onValueChange={(v) => setDept(v === "__all__" ? "" : v)}>
            <SelectTrigger aria-label="Filter by department" className="h-9 w-full rounded-xl bg-white lg:w-52">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.code}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Sort people" className="h-9 w-full rounded-xl bg-white lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="projects">Most projects</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2.5 rounded-xl border border-up-border bg-white px-3.5 text-sm font-medium text-muted-foreground transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
            <Switch
              checked={teammates}
              onCheckedChange={setTeammates}
              aria-label="Only people open to teamwork"
            />
            Open to teamwork
          </label>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8">
        {loading ? (
          <CardSkeletonGrid count={6} />
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Something went wrong"
            hint="We couldn't load the directory. Check your connection and try again."
            action={
              <Button
                onClick={() => {
                  setPeople(null);
                  setError(false);
                  setRetry((r) => r + 1);
                }}
                variant="outline"
                className="rounded-xl font-semibold"
              >
                Try again
              </Button>
            }
          />
        ) : count === 0 ? (
          <EmptyState
            icon={Users}
            title="No people found"
            hint="Try a different name, skill, or department — or clear the filters."
            action={
              hasFilters ? (
                <Button onClick={clearFilters} variant="outline" className="rounded-xl font-semibold">
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {people?.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                onOpen={(username) => navigate({ name: "profile", username })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PersonCard({
  person,
  onOpen,
}: {
  person: UserDirectoryEntry;
  onOpen: (username: string) => void;
}) {
  const skills = useMemo(() => person.skills.slice(0, 3), [person.skills]);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`View profile: ${person.displayName}`}
      onClick={() => onOpen(person.username)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(person.username);
        }
      }}
      className="card-hover flex h-full cursor-pointer flex-col rounded-2xl border border-up-border bg-card p-5 text-left shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <UserAvatar
          name={person.displayName}
          avatarUrl={person.avatarUrl}
          ring={false}
          className="size-12 text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate font-semibold tracking-tight text-foreground">
              {person.displayName}
            </h2>
            <StaffBadge role={person.role} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">@{person.username}</p>
        </div>
      </div>

      {person.program ? (
        <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">{person.program}</p>
      ) : null}

      {skills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <span
              key={s}
              className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      <div className="min-h-4 flex-1" aria-hidden />
      <div className="flex items-center justify-between gap-2 border-t border-up-border pt-3 text-xs">
        <p className="text-xs font-medium text-muted-foreground">
          {person.projectCount} {person.projectCount === 1 ? "project" : "projects"}
        </p>
        {person.lookingForTeammates ? <TeammateWantedChip /> : null}
      </div>
    </article>
  );
}
