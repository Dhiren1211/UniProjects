"use client";

// ============================================================
// HomeView - minimal, Swiss-style landing page.
// Full-bleed campus photo intro, a numbered "how it works" list and the project grids.
// One accent colour, hairline rules, generous white space.
// ============================================================

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { UNIVERSITY } from "@/lib/config";
import {
  fetchProjects,
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

  useEffect(() => {
    const ac = new AbortController();
    fetchProjects({ featured: "1" }, ac.signal)
      .then(setFeatured)
      .catch(() => !ac.signal.aborted && setFeatured([]));
    fetchProjects({ sort: "newest" }, ac.signal)
      .then(setLatest)
      .catch(() => !ac.signal.aborted && setLatest([]));
    return () => ac.abort();
  }, []);

  const openProject = (slug: string) => navigate({ name: "project", slug });

  return (
    <>
      <Intro
        navigate={navigate}
        title={settings?.heroTitle ?? "Capstone Contest..."}
        lead={
          settings?.heroSubtitle ??
          "Explore student ideas, discover working projects, and celebrate a year of capstone design."
        }
        image={
          settings
            ? settings.heroImage || "/hero/ksu-central-library.jpg"
            : null
        }
        user={user}
      />

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
      className="relative isolate overflow-hidden bg-night"
    >
      {/* Full-bleed campus photo - admins change it in Admin → Settings */}
      {image ? (
        <motion.img
          src={image}
          alt=""
          aria-hidden
          fetchPriority="high"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.6 }}
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      ) : null}
      {/* Deep navy wash on the copy side, fading out so the photo shows on the right */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[#06215f] via-[#0a2c7a]/80 to-[#0a2c7a]/20 md:bg-gradient-to-r md:from-[#06215f] md:via-[#0a2c7a]/75 md:via-45% md:to-transparent md:to-75%"
      />

      <div className="wrap flex min-h-[560px] flex-col justify-end py-16 md:min-h-[80vh] md:justify-center md:py-24">
        <motion.p
          {...enter(0)}
          className="text-[0.8125rem] font-semibold uppercase tracking-[0.4em] text-white md:text-[0.9375rem]"
        >
          {UNIVERSITY.name}
        </motion.p>

        <motion.h1
          {...enter(0.05)}
          id="home-title"
          className="mt-5 font-display text-[3.5rem] font-extrabold leading-[0.95] tracking-[-0.03em] text-white sm:text-[4.5rem] md:text-[6.5rem]"
        >
          <TwoToneTitle text={title} />
        </motion.h1>

        <motion.p
          {...enter(0.1)}
          className="mt-6 max-w-[38ch] text-pretty text-[1.1875rem] font-medium leading-snug text-white md:text-[1.5rem]"
        >
          {lead}
        </motion.p>

        <motion.div
          {...enter(0.15)}
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6"
        >
          {/* Signed out: "Request an account  or  Browse projects" */}
          {!user ? (
            <>
              <Button
                variant="outline"
                onClick={() => navigate({ name: "account-request" })}
                className={HERO_OUTLINE}
              >
                Request an account
              </Button>
              <span className="text-center text-lg font-medium text-white">or</span>
              <Button
                onClick={() => navigate({ name: "projects" })}
                className={HERO_SOLID}
              >
                Browse projects
                <MArrow />
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => navigate({ name: "projects" })}
                className={HERO_SOLID}
              >
                Browse projects
                <MArrow />
              </Button>
              {canSubmit(user) ? (
                <Button
                  variant="outline"
                  onClick={() => navigate({ name: "create" })}
                  className={HERO_OUTLINE}
                >
                  Submit your capstone
                </Button>
              ) : null}
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}

const HERO_SOLID =
  "h-14 cursor-pointer gap-2 rounded-xl px-7 text-lg font-bold shadow-lg shadow-black/20";
const HERO_OUTLINE =
  "h-14 cursor-pointer rounded-xl border-2 border-white/90 bg-transparent px-7 text-lg font-medium text-white hover:border-white hover:bg-white/10 hover:text-white";

/** "Capstone Contest..." → white first line, light-blue last word on its own line. */
function TwoToneTitle({ text }: { text: string }) {
  const t = text.trim();
  const cut = t.lastIndexOf(" ");
  if (cut < 0) return <>{t}</>;
  return (
    <>
      <span className="block">{t.slice(0, cut)}</span>
      <span className="block text-[#a8d4ff]">{t.slice(cut + 1)}</span>
    </>
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
            className="link mt-5 inline-flex cursor-pointer items-center gap-1.5 text-[1.2rem] font-medium text-primary-700 outline-none focus-visible:outline-2 focus-visible:outline-ring"
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
                className="text-[1.3rem] font-medium tabular-nums text-primary-700"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-[1.3rem] font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 max-w-[60ch] text-[1.2rem] leading-relaxed text-ink-700">
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
        className="text-[1.625rem] font-semibold leading-tight tracking-tight text-foreground md:text-[2rem]"
      >
        {title}
      </h2>
      <p className="mt-2 max-w-[48ch] text-[1rem] text-ink-700 md:text-base">
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
              className="link inline-flex cursor-pointer items-center gap-1.5 text-[1rem] font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:outline-ring"
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
      <p className="mx-auto mt-2 max-w-[44ch] text-[1rem] text-ink-700">
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
