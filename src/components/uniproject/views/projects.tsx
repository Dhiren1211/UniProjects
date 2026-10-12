"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SearchX, X } from "lucide-react";
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
import { CardSkeletonGrid, EmptyState } from "../ui-bits";

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

  const { user } = useAppStore();

  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null); // null = loading
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
  if (category) activeFilters.push({ label: category, clear: () => setCategory("") });
  if (year) activeFilters.push({ label: `Year ${year}`, clear: () => setYear("") });
  if (teammates)
    activeFilters.push({ label: "Open to teammates", clear: () => setTeammates(false) });
  if (verifiedOnly)
    activeFilters.push({ label: "Verified only", clear: () => setVerifiedOnly(false) });
  if (mine) activeFilters.push({ label: "My projects", clear: () => setMine(false) });

  const hasFilters = activeFilters.length > 0;
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

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 pb-20 md:px-8 md:py-14">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            All projects
          </h1>
          <p className="mt-2 text-sm tabular-nums text-muted-foreground md:text-base" aria-live="polite">
            {loading
              ? "Loading projects…"
              : error
                ? "Something went wrong while loading."
                : hasFilters
                  ? `Showing ${projects?.length ?? 0} matching ${projects?.length === 1 ? "project" : "projects"}`
                  : `${projects?.length ?? 0} ${projects?.length === 1 ? "project" : "projects"} from every department`}
          </p>
        </div>
      </div>

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
              aria-label="Search projects"
              placeholder="Search by title, team, supervisor, or tag…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 rounded-xl bg-white pl-10"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
            <Select value={dept || "__all__"} onValueChange={(v) => setDept(v === "__all__" ? "" : v)}>
              <SelectTrigger aria-label="Filter by department" className="h-9 w-full rounded-xl bg-white lg:w-44">
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

            <Select
              value={category || "__all__"}
              onValueChange={(v) => setCategory(v === "__all__" ? "" : v)}
            >
              <SelectTrigger aria-label="Filter by category" className="h-9 w-full rounded-xl bg-white lg:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={year || "__all__"} onValueChange={(v) => setYear(v === "__all__" ? "" : v)}>
              <SelectTrigger aria-label="Filter by year" className="h-9 w-full rounded-xl bg-white lg:w-32">
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

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger aria-label="Sort projects" className="h-9 w-full rounded-xl bg-white lg:w-40">
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

        {/* Toggle filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-2.5 rounded-full border px-3.5 text-xs font-medium transition-colors has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring has-[button:focus-visible]:ring-offset-2",
              teammates
                ? "border-primary-200 bg-primary-50 text-primary-700"
                : "border-up-border bg-white text-muted-foreground hover:border-up-border-strong hover:text-foreground"
            )}
          >
            <Switch
              checked={teammates}
              onCheckedChange={setTeammates}
              aria-label="Only projects open to teammates"
            />
            Open to teammates
          </label>
          <label
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-2.5 rounded-full border px-3.5 text-xs font-medium transition-colors has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring has-[button:focus-visible]:ring-offset-2",
              verifiedOnly
                ? "border-primary-200 bg-primary-50 text-primary-700"
                : "border-up-border bg-white text-muted-foreground hover:border-up-border-strong hover:text-foreground"
            )}
          >
            <Switch
              checked={verifiedOnly}
              onCheckedChange={setVerifiedOnly}
              aria-label="Only verified projects"
            />
            Verified only
          </label>
        </div>

        {/* Active filter chips */}
        {hasFilters || user ? (
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            {activeFilters.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={f.clear}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {f.label}
                <X className="size-3" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            {user ? (
              <button
                type="button"
                onClick={() => setMine((v) => !v)}
                aria-pressed={mine}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  mine
                    ? "bg-primary-500 text-white"
                    : "border border-up-border bg-white text-muted-foreground hover:border-up-border-strong hover:text-foreground"
                )}
              >
                My projects
              </button>
            ) : null}
            {hasFilters ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              >
                Clear all
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Results */}
      <div className="mt-8">
        {loading ? (
          <CardSkeletonGrid count={6} />
        ) : error ? (
          <EmptyState
            icon={SearchX}
            title="Something went wrong"
            hint="We couldn't load the projects. Check your connection and try again."
            action={
              <Button onClick={() => setRetry((r) => r + 1)} variant="outline" className="rounded-xl font-semibold">
                Try again
              </Button>
            }
          />
        ) : projects && projects.length === 0 ? (
          <EmptyState
            title="No projects found"
            hint={
              hasFilters
                ? "Try removing a filter or using a broader search term."
                : "Nothing has been submitted yet — your project could be the first."
            }
            action={
              hasFilters ? (
                <Button onClick={clearAll} variant="outline" className="rounded-xl font-semibold">
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects?.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={(slug) => navigate({ name: "project", slug })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
