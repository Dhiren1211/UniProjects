"use client";

// ============================================================
// HomeView - minimal and informational.
// A plain intro, how the showcase works, featured projects and
// the latest projects. No promotional bands, loops or effects.
// ============================================================

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ClipboardCheck, IdCard, UsersRound } from "lucide-react";
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
        image={settings?.heroImage || "/hero/ksu-central-library.jpg"}
        stats={stats}
        user={user}
      />

      <HowItWorks signedIn={Boolean(user)} navigate={navigate} />

      <ProjectSection
        id="featured"
        title="Featured projects"
        line="Chosen by the capstone office from across the departments."
        projects={featured === null ? null : featured.slice(0, 3)}
        skeleton={3}
        empty="No featured projects yet."
        onOpen={openProject}
        navigate={navigate}
      />

      <ProjectSection
        id="latest"
        title="Latest projects"
        line="The newest submissions from every capstone section."
        projects={latest === null ? null : latest.slice(0, 6)}
        skeleton={6}
        empty="Nothing has been published yet."
        onOpen={openProject}
        navigate={navigate}
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
  stats,
  user,
}: {
  navigate: Navigate;
  title: string;
  lead: string;
  image: string;
  stats: StatsDTO | null;
  user: ReturnType<typeof useAppStore.getState>["user"];
}) {
  const reduce = useReducedMotion();
  return (
    <section id="top" className="relative isolate overflow-hidden bg-up-night">
      {/* Kyungsung University campus photo (admin can change it in Settings) */}
      <img
        src={image}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 size-full object-cover object-[70%_40%]"
      />
      {/* scrim: dark on the text side, the photo stays visible on the right */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/70 to-black/60 md:via-black/55 md:to-black/15"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-black/40 to-transparent" />

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="wrap flex min-h-[460px] flex-col justify-center py-16 md:min-h-[560px] md:py-24"
      >
        <p className="text-[13px] font-medium text-white/75">
          {UNIVERSITY.name} · Capstone design
          {stats ? ` · ${stats.projects} projects in ${stats.latestYear}` : ""}
        </p>
        <h1 className="mt-4 max-w-[20ch] text-[34px] leading-[1.08] text-white md:text-[52px]">
          {title}
        </h1>
        <p className="mt-6 w-fit max-w-[56ch] rounded-[12px] border border-white/15 border-l-2 border-l-sky-400 bg-black/20 px-5 py-4 text-lg leading-8 text-white backdrop-blur-[2px]">
          {lead}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => navigate({ name: "projects" })} className="h-11 gap-2 px-5 text-[15px]">
            Browse projects
            <MArrow />
          </Button>
          {!user ? (
            <Button
              variant="outline"
              onClick={() => navigate({ name: "account-request" })}
              className="h-11 border-white/40 bg-white/10 px-5 text-[15px] text-white backdrop-blur-sm hover:border-white/70 hover:bg-white/20 hover:text-white"
            >
              Request an account
            </Button>
          ) : canSubmit(user) ? (
            <Button
              variant="outline"
              onClick={() => navigate({ name: "create" })}
              className="h-11 border-white/40 bg-white/10 px-5 text-[15px] text-white backdrop-blur-sm hover:border-white/70 hover:bg-white/20 hover:text-white"
            >
              Submit your capstone
            </Button>
          ) : null}
        </div>
      </motion.div>
    </section>
  );
}

// ---------- how it works ----------

const STEPS = [
  {
    title: "Request an account",
    body: "There is no public sign-up. The capstone coordinator creates your account and sends the details to your university email.",
    icon: IdCard,
  },
  {
    title: "Team up in your section",
    body: "Join your capstone class and form a team around your professor. One student leads the team.",
    icon: UsersRound,
  },
  {
    title: "Submit and get verified",
    body: "The team leader publishes the project. Your professor reviews it and adds the verified badge.",
    icon: ClipboardCheck,
  },
];

const SIGNED_IN_FIRST = {
  title: "Your account is active",
  body: "You're signed in. Your dashboard shows deadlines, your section and your team.",
  icon: IdCard,
};

function HowItWorks({ signedIn, navigate }: { signedIn: boolean; navigate: Navigate }) {
  const steps = signedIn ? [SIGNED_IN_FIRST, ...STEPS.slice(1)] : STEPS;
  return (
    <section id="how" aria-labelledby="how-title" className="border-b border-up-border">
      <div className="wrap py-14 md:py-20">
        <SectionHead
          id="how-title"
          title="How it works"
          line="From account to verified project in three steps."
        />
        <ol className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="rounded-[16px] border border-up-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary-50 text-primary-700">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="t-label">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-medium text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-700">{step.body}</p>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-[15px] text-ink-700">
          Accounts, submissions and verification are covered in the{" "}
          <button
            type="button"
            onClick={() => navigate({ name: "guidelines" })}
            className="link font-medium text-primary-700 outline-none focus-visible:outline-2 focus-visible:outline-ring"
          >
            guidelines
          </button>
          .
        </p>
      </div>
    </section>
  );
}

// ---------- project grids ----------

function SectionHead({ id, title, line }: { id?: string; title: string; line: string }) {
  return (
    <div>
      <h2 id={id} className="text-[26px] leading-tight text-foreground md:text-[32px]">
        {title}
      </h2>
      <p className="mt-2 text-[15px] text-ink-700 md:text-base">{line}</p>
    </div>
  );
}

function ProjectSection({
  id,
  title,
  line,
  projects,
  skeleton,
  empty,
  onOpen,
  navigate,
}: {
  id: string;
  title: string;
  line: string;
  projects: ProjectListItem[] | null;
  skeleton: number;
  empty: string;
  onOpen: (slug: string) => void;
  navigate: Navigate;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="border-b border-up-border last:border-b-0">
      <div className="wrap py-14 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead id={`${id}-title`} title={title} line={line} />
          <Button variant="outline" onClick={() => navigate({ name: "projects" })} className="h-10 px-4 text-sm">
            View all
          </Button>
        </div>
        <div className="mt-8">
          {projects === null ? (
            <CardSkeletonGrid count={skeleton} />
          ) : projects.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <p className="rounded-[16px] border border-dashed border-up-border px-6 py-10 text-center text-[15px] text-ink-700">
              {empty}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
