"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Search, SearchX, UserRound, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, SORTS, YEARS } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  fetchDepartments,
  fetchProjects,
  type DepartmentDTO,
  type Navigate,
  type ProjectListItem,
  type View,
} from "../api-client";
import { useAppStore } from "../store";
import { ProjectCard } from "../project-card";
import { CardSkeletonGrid, CategoryIcon, EmptyState } from "../ui-bits";

export function ProjectsView({
  initial,
  navigate,
}: {
  initial: Extract<View, { name: "projects" }>;
  navigate: Navigate;
}) {
  const [q, setQ] = useState(initial.q ?? "");
  const [debouncedQ, setDebouncedQ] = useState(initial.q ?? "");
  const [dept, setDept] = useState(initial.dept ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [year, setYear] = useState(initial.year ? String(initial.year) : "");
  const [sort, setSort] = useState("newest");
  const [teammates, setTeammates] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [mine, setMine] = useState(false);

  const { user, settings } = useAppStore();
  // Global search toggle (requirement 2) - hide the search field when disabled; filters stay.
  const searchEnabled = settings?.searchEnabled !== false;

  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null); // null = loading
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // departments are static - load once
  useEffect(() => {
    const ac = new AbortController();
    fetchDepartments(ac.signal)
      .then(setDepartments)
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // main listing
  useEffect(() => {
    const ac = new AbortController();
    fetchProjects(
      {
        q: debouncedQ || undefined,
        dept: dept || undefined,
        category: category || undefined,
        year: year || undefined,
        sort,
        teammates: teammates ? "1" : undefined,
        verified: verifiedOnly ? "1" : undefined,
        status: mine ? "MINE" : undefined,
      },
      ac.signal
    )
      .then((rows) => {
        setProjects(rows);
        setError(false);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setProjects([]);
        setError(true);
      });
    return () => ac.abort();
  }, [debouncedQ, dept, category, year, teammates, verifiedOnly, mine, sort, retry]);

  const deptName = useMemo(
    () => departments.find((d) => d.code === dept)?.name ?? dept,
    [departments, dept]
  );

  const activeFilters: { label: string; clear: () => void }[] = [];
  if (debouncedQ) activeFilters.push({ label: `“${debouncedQ}”`, clear: () => setQ("") });
  if (dept)
    activeFilters.push({
      label: deptName,
      clear: () => setDept(""),
    });
  if (year) activeFilters.push({ label: `Year ${year}`, clear: () => setYear("") });

  const hasFilters = activeFilters.length > 0 || Boolean(category) || teammates || verifiedOnly || mine;
  const loading = projects === null;

  const clearAll = () => {
    setQ("");
    setDept("");
    setCategory("");
    setYear("");
    setTeammates(false);
    setVerifiedOnly(false);
    setMine(false);
  };

  const chip = (on: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      on
        ? "border-primary bg-primary text-primary-foreground"
        : "border-up-border bg-card text-ink-700 hover:border-up-border-strong hover:text-foreground",
    );

  const count = projects?.length ?? 0;

  return (
    <>
      <div className="wrap py-8 md:py-10">
        <h1 className="mb-6 text-[30px] leading-tight text-foreground md:text-[36px]">Projects</h1>

        {/* ---------- toolbar ---------- */}
        <div className="rounded-[16px] border border-up-border bg-card p-3 md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {searchEnabled ? (
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-500"
                  aria-hidden
                />
                <Input
                  aria-label="Search projects"
                  placeholder="Search by title, team, supervisor or tag"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-11 rounded-[10px] bg-background pl-10 text-[15px]"
                />
                {q ? (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-500 hover:bg-secondary hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
              <Select value={dept || "__all__"} onValueChange={(v) => setDept(v === "__all__" ? "" : v)}>
                <SelectTrigger aria-label="Filter by department" className="h-11 w-full rounded-[10px] bg-background sm:w-52">
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

              <Select value={year || "__all__"} onValueChange={(v) => setYear(v === "__all__" ? "" : v)}>
                <SelectTrigger aria-label="Filter by year" className="h-11 w-full rounded-[10px] bg-background sm:w-32">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All years</SelectItem>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* categories + quick toggles */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto border-t border-up-border pt-3 scrollbar-none">
            <button type="button" aria-pressed={!category} onClick={() => setCategory("")} className={chip(!category)}>
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(category === c ? "" : c)}
                className={chip(category === c)}
              >
                <CategoryIcon category={c} className="size-4" />
                {c}
              </button>
            ))}
            <span className="mx-1 h-5 w-px shrink-0 bg-up-border" aria-hidden />
            <button type="button" aria-pressed={teammates} onClick={() => setTeammates((v) => !v)} className={chip(teammates)}>
              <Users className="size-4" aria-hidden />
              Open to teammates
            </button>
            <button type="button" aria-pressed={verifiedOnly} onClick={() => setVerifiedOnly((v) => !v)} className={chip(verifiedOnly)}>
              <BadgeCheck className="size-4" aria-hidden />
              Verified
            </button>
            {user ? (
              <button type="button" aria-pressed={mine} onClick={() => setMine((v) => !v)} className={chip(mine)}>
                <UserRound className="size-4" aria-hidden />
                My projects
              </button>
            ) : null}
          </div>
        </div>

        {/* ---------- results bar ---------- */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2" aria-live="polite">
            <p className="text-[15px] text-foreground">
              {loading ? (
                "Loading projects…"
              ) : error ? (
                "Couldn't load projects"
              ) : (
                <>
                  <span className="font-medium tabular-nums">{count}</span>{" "}
                  {count === 1 ? "project" : "projects"}
                  {hasFilters ? " match" : ""}
                </>
              )}
            </p>
            {activeFilters.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={f.clear}
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[13px] font-medium text-primary-700 outline-none transition-colors hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-ring"
              >
                {f.label}
                <X className="size-3.5" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            {hasFilters ? (
              <button
                type="button"
                onClick={clearAll}
                className="link text-[13px] font-medium text-ink-700 outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="t-label hidden sm:inline">Sort</span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger aria-label="Sort projects" className="h-9 w-40 rounded-[10px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ---------- results ---------- */}
        <div className="mt-5">
          {loading ? (
            <CardSkeletonGrid count={6} />
          ) : error ? (
            <EmptyState
              icon={SearchX}
              title="Couldn't load projects"
              hint="Check your connection and try again."
              action={
                <Button onClick={() => setRetry((r) => r + 1)} variant="outline">
                  Try again
                </Button>
              }
            />
          ) : count === 0 ? (
            <EmptyState
              title="No projects found"
              hint={
                hasFilters
                  ? "Try removing a filter or using a broader search term."
                  : "Nothing has been published yet."
              }
              action={
                hasFilters ? (
                  <Button onClick={clearAll} variant="outline">
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {projects?.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={(slug) => navigate({ name: "project", slug })} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
