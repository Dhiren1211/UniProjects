"use client";

// ============================================================
// HomeView - minimal, Swiss-style landing page.
// Split intro (copy + framed campus photo), a quiet stats row,
// a numbered "how it works" list and the project grids.
// One accent colour, hairline rules, generous white space.
// ============================================================

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { UNIVERSITY } from "@/lib/config";
import type { StatsDTO } from "@/lib/types";
import {
  fetchProjects,
  fetchStats,
  type Navigate,
  type ProjectListItem,
} from "../api-client";
import { canSubmit, useAppStore } from "../store";
import { ProjectCard } from "../project-card";
import { CardSkeletonGrid, MArrow } from "../ui-bits";

type Viewer = ReturnType<typeof useAppStore.getState>["user"];

export function HomeView({ navigate }: { navigate: Navigate }) {
  const settings = useAppStore((s) => s.settings);
  const user = useAppStore((s) => s.user);
  const [featured, setFeatured] = useState<ProjectListItem[] | null>(null);
  const [latest, setLatest] = useState<ProjectListItem[] | null>(null);
  const [stats, setStats] = useState<StatsDTO | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchProjects({ featured: "1" }, ac.signal)
      .then(setFeatured)
      .catch(() => !ac.signal.aborted && setFeatured([]));
    fetchProjects({ sort: "newest" }, ac.signal)
      .then(setLatest)
      .catch(() => !ac.signal.aborted && setLatest([]));
    fetchStats(ac.signal)
      .then(setStats)
      .catch(() => {});
    return () => ac.abort();
  }, []);

  const openProject = (slug: string) => navigate({ name: "project", slug });

  return (
    <>
      <Intro
        navigate={navigate}
        title={settings?.heroTitle ?? "Kyungsung University Capstone Showcase"}
        lead={
          settings?.heroSubtitle ??
          "Student teams turn a year of capstone design work into published, searchable projects that are supervised, verified and open to everyone."
        }
        image={
          settings
            ? settings.heroImage || "/hero/ksu-central-library.jpg"
            : null
        }
        user={user}
      />

      <StatsRow stats={stats} />

      <HowItWorks signedIn={Boolean(user)} navigate={navigate} />

      {/* Featured only appears once the capstone office has featured something. */}
      {featured === null || featured.length > 0 ? (
        <ProjectSection
          id="featured"
          title="Featured"
          line="Chosen by the capstone office from across the departments."
          projects={featured === null ? null : featured.slice(0, 3)}
          skeleton={3}
          onOpen={openProject}
          navigate={navigate}
        />
      ) : null}

      <ProjectSection
        id="latest"
        title="Latest projects"
        line="The newest submissions from every capstone section."
        projects={latest === null ? null : latest.slice(0, 6)}
        skeleton={3}
        onOpen={openProject}
        navigate={navigate}
        user={user}
      />
    </>
  );
}

// ---------- intro ----------

function Intro({
  navigate,
  title,
  lead,
  image,
  user,
}: {
  navigate: Navigate;
  title: string;
  lead: string;
  image: string | null; // null while settings load - avoids flashing the fallback photo
  user: Viewer;
}) {
  const reduce = useReducedMotion();
  const enter = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.4,
      delay: reduce ? 0 : delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  });

  return (
    <section
      id="top"
      aria-labelledby="home-title"
      className="border-b border-up-border"
    >
      <div className="wrap grid items-center gap-10 py-14 md:grid-cols-[1.1fr_1fr] md:gap-14 md:py-24">
        <div>
          <motion.p
            {...enter(0)}
            className="flex items-center gap-2 text-[13px] font-medium text-ink-700"
          >
            <span aria-hidden className="h-px w-6 bg-primary" />
            {UNIVERSITY.name} · Capstone design
          </motion.p>

          <motion.h1
            {...enter(0.05)}
            id="home-title"
            className="mt-5 max-w-[18ch] text-balance text-[36px] font-semibold leading-[1.05] tracking-tight text-foreground md:text-[56px]"
          >
            {title}
          </motion.h1>

          <motion.p
            {...enter(0.1)}
            className="mt-6 max-w-[52ch] text-pretty text-[17px] leading-relaxed text-ink-700"
          >
            {lead}
          </motion.p>

          <motion.div
            {...enter(0.15)}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button
              onClick={() => navigate({ name: "projects" })}
              className="h-11 cursor-pointer gap-2 px-5 text-[15px]"
            >
              Browse projects
              <MArrow />
            </Button>
            {!user ? (
              <Button
                variant="ghost"
                onClick={() => navigate({ name: "account-request" })}
                className="h-11 cursor-pointer px-4 text-[15px] text-foreground"
              >
                Request an account
              </Button>
            ) : canSubmit(user) ? (
              <Button
                variant="ghost"
                onClick={() => navigate({ name: "create" })}
                className="h-11 cursor-pointer px-4 text-[15px] text-foreground"
              >
                Submit your capstone
              </Button>
            ) : null}
          </motion.div>
        </div>

        {/* Campus photo - admins change it in Admin → Settings */}
        <motion.figure
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: reduce ? 0 : 0.1 }}
          className="relative overflow-hidden rounded-[20px] border border-up-border bg-surface-muted"
        >
          {image ? (
            <img
              src={image}
              alt={`${UNIVERSITY.name} campus`}
              width={1200}
              height={900}
              fetchPriority="high"
              className="aspect-[4/3] size-full object-cover"
            />
          ) : (
            <div aria-hidden className="aspect-[4/3] w-full animate-pulse" />
          )}
        </motion.figure>
      </div>
    </section>
  );
}

// ---------- stats ----------

function StatsRow({ stats }: { stats: StatsDTO | null }) {
  const items = [
    { label: "Published projects", value: stats?.projects },
    { label: "Verified by professors", value: stats?.verified },
    { label: "Departments", value: stats?.departments },
    { label: "Students", value: stats?.students },
  ];
  return (
    <section
      aria-label="Showcase in numbers"
      className="border-b border-up-border"
    >
      <dl className="wrap grid grid-cols-2 md:grid-cols-4">
        {items.map((it, i) => (
          <div
            key={it.label}
            className={[
              "py-7 md:py-9",
              i % 2 === 1 ? "pl-6 md:pl-8" : "",
              i >= 2 ? "border-t border-up-border md:border-t-0" : "",
              i > 0 ? "md:border-l md:border-up-border md:pl-8" : "",
              i % 2 === 1 ? "border-l border-up-border" : "",
            ].join(" ")}
          >
            <dt className="text-[13px] text-ink-700">{it.label}</dt>
            <dd className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-foreground md:text-[32px]">
              {it.value ?? (
                <span className="inline-block h-7 w-10 animate-pulse rounded bg-surface-muted align-middle" />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------- how it works ----------

const STEPS = [
  {
    title: "Request an account",
    body: "There is no public sign-up. The capstone coordinator creates your account and sends the details to your university email.",
  },
  {
    title: "Team up in your section",
    body: "Join your capstone class and form a team around your professor. One student leads the team.",
  },
  {
    title: "Submit and get verified",
    body: "The team leader publishes the project. Your professor reviews it and adds the verified badge.",
  },
];

const SIGNED_IN_FIRST = {
  title: "Your account is active",
  body: "You're signed in. Your dashboard shows deadlines, your section and your team.",
};

function HowItWorks({
  signedIn,
  navigate,
}: {
  signedIn: boolean;
  navigate: Navigate;
}) {
  const steps = signedIn ? [SIGNED_IN_FIRST, ...STEPS.slice(1)] : STEPS;
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="border-b border-up-border"
    >
      <div className="wrap grid gap-10 py-16 md:grid-cols-[1fr_2fr] md:gap-14 md:py-24">
        <div>
          <SectionHead
            id="how-title"
            title="How it works"
            line="From account to verified project in three steps."
          />
          <button
            type="button"
            onClick={() => navigate({ name: "guidelines" })}
            className="link mt-5 inline-flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-primary-700 outline-none focus-visible:outline-2 focus-visible:outline-ring"
          >
            Read the guidelines
            <MArrow />
          </button>
        </div>

        <ol className="divide-y divide-up-border border-y border-up-border">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="grid grid-cols-[3rem_1fr] gap-4 py-6 md:grid-cols-[4rem_1fr] md:py-7"
            >
              <span
                aria-hidden
                className="text-[15px] font-medium tabular-nums text-primary-700"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-lg font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 max-w-[60ch] text-[15px] leading-relaxed text-ink-700">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------- project grids ----------

function SectionHead({
  id,
  title,
  line,
}: {
  id?: string;
  title: string;
  line: string;
}) {
  return (
    <div>
      <h2
        id={id}
        className="text-[26px] font-semibold leading-tight tracking-tight text-foreground md:text-[32px]"
      >
        {title}
      </h2>
      <p className="mt-2 max-w-[48ch] text-[15px] text-ink-700 md:text-base">
        {line}
      </p>
    </div>
  );
}

function ProjectSection({
  id,
  title,
  line,
  projects,
  skeleton,
  onOpen,
  navigate,
  user,
}: {
  id: string;
  title: string;
  line: string;
  projects: ProjectListItem[] | null;
  skeleton: number;
  onOpen: (slug: string) => void;
  navigate: Navigate;
  user?: Viewer;
}) {
  const hasProjects = projects !== null && projects.length > 0;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-b border-up-border last:border-b-0"
    >
      <div className="wrap py-16 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead id={`${id}-title`} title={title} line={line} />
          {hasProjects ? (
            <button
              type="button"
              onClick={() => navigate({ name: "projects" })}
              className="link inline-flex cursor-pointer items-center gap-1.5 text-[15px] font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring"
            >
              View all
              <MArrow />
            </button>
          ) : null}
        </div>
        <div className="mt-10">
          {projects === null ? (
            <CardSkeletonGrid count={skeleton} />
          ) : hasProjects ? (
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <EmptyProjects navigate={navigate} user={user} />
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyProjects({
  navigate,
  user,
}: {
  navigate: Navigate;
  user?: Viewer;
}) {
  const action = !user
    ? { label: "Request an account", to: { name: "account-request" } as const }
    : canSubmit(user)
      ? { label: "Submit your capstone", to: { name: "create" } as const }
      : null;
  return (
    <div className="rounded-[20px] border border-dashed border-up-border px-6 py-14 text-center">
      <p className="text-lg font-medium text-foreground">
        No projects published yet
      </p>
      <p className="mx-auto mt-2 max-w-[44ch] text-[15px] text-ink-700">
        Projects appear here as soon as capstone teams publish them.
      </p>
      {action ? (
        <Button
          variant="outline"
          onClick={() => navigate(action.to)}
          className="mt-6 h-10 cursor-pointer gap-2 px-4 text-sm"
        >
          {action.label}
          <MArrow />
        </Button>
      ) : null}
    </div>
  );
}
