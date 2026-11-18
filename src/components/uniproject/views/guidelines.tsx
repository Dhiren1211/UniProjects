"use client";

// ============================================================
// Guidelines - a documentation page. Full-width header, an
// "On this page" index that follows the scroll, and the reading
// column: accounts, submissions, verification, the semester
// timeline and the FAQ (open in full). No data fetching.
// ============================================================

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { UNIVERSITY } from "@/lib/config";
import type { Navigate } from "../api-client";
import { useAppStore } from "../store";

const SECTIONS = [
  { id: "g-account", label: "Getting an account" },
  { id: "g-submit", label: "Submitting a project" },
  { id: "g-verify", label: "Verification" },
  { id: "g-timeline", label: "Semester timeline" },
  { id: "g-faq", label: "Questions" },
] as const;

const CHECKLIST = [
  "A clear title and a summary of at least 20 characters",
  "A description of at least 60 characters: what it does and how it was built",
  "A cover image, the first thing reviewers see",
  "Up to 8 topic tags, such as #computer-vision or #accessibility",
  "Your team members, added by student ID or username",
];

const TIMELINE = [
  { when: "Weeks 1–2", title: "Team formation", body: "Sections are confirmed, teams form around a professor, and every member requests an account." },
  { when: "Week 4", title: "Proposal", body: "The team leader drafts the project page with a summary, description and plan, and keeps it as a draft until it's ready." },
  { when: "Week 9", title: "Midterm review", body: "Progress is published with photos and links. Professors check each team's page during the review window." },
  { when: "Week 16", title: "Final demo day", body: "Everything is published, verified projects are featured, and the showcase opens to the whole campus." },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Who can submit a project?",
    a: "One submission per team, made by the team leader. Professors, moderators and administrators can also submit on behalf of a team. Other members can't publish directly, so ask your team leader.",
  },
  {
    q: "I lost my password",
    a: `Ask the capstone coordinator to reset it. They issue a new temporary password from the admin panel and send it to your ${UNIVERSITY.domain} email. Sign-in uses your student ID, or your username for staff.`,
  },
  {
    q: "Can members edit the project?",
    a: "Only the team leader and staff can edit the project details, upload gallery photos or publish drafts. Other members can still request to join, comment and follow.",
  },
  {
    q: "How do I get verified?",
    a: "Once your project is published, press Request verification on the project page. The professor of your section reviews it, and the verified badge then appears on your project card everywhere.",
  },
  {
    q: "Where do announcements appear?",
    a: "Every announcement from the capstone office is on the Announcements page, with pinned items on top. Check there for deadlines, review windows and demo-day details.",
  },
];

export function GuidelinesView({ navigate }: { navigate: Navigate }) {
  const user = useAppStore((s) => s.user);
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  // Mark the section being read in the index
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  const inlineLink =
    "link font-medium text-primary-700 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <>
      {/* ---------- page header ---------- */}
      <header className="border-b border-up-border">
        <div className="wrap py-14 md:py-20">
          <p className="t-label">{UNIVERSITY.name} · Capstone design</p>
          <h1 className="mt-4 text-[34px] leading-[1.08] text-foreground md:text-[48px]">Guidelines</h1>
          <p className="mt-4 max-w-[62ch] text-lg leading-8 text-ink-700">
            How the showcase works, from requesting an account to seeing your capstone verified.
            Read it once and you know the whole flow.
          </p>
        </div>
      </header>

      <div className="wrap grid grid-cols-1 gap-10 py-12 md:py-16 lg:grid-cols-12 lg:gap-6">
        {/* ---------- index ---------- */}
        <nav aria-label="On this page" className="min-w-0 lg:col-span-3">
          <div className="lg:sticky lg:top-[104px]">
            <p className="t-label">On this page</p>
            <ol className="-mx-4 mt-3 flex gap-1 overflow-x-auto overscroll-x-contain border-b px-4 lg:mx-0 lg:px-0 border-up-border pb-3 scrollbar-none lg:flex-col lg:gap-0 lg:border-b-0 lg:border-l lg:pb-0">
              {SECTIONS.map((s, i) => {
                const on = activeId === s.id;
                return (
                  <li key={s.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => jump(s.id)}
                      aria-current={on ? "true" : undefined}
                      className={cn(
                        "flex min-h-[40px] w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 text-left text-[15px] outline-none transition-colors focus-visible:outline-2 focus-visible:outline-ring lg:-ml-px lg:rounded-none lg:border-l-2",
                        on
                          ? "bg-primary-50 font-medium text-foreground lg:border-primary lg:bg-transparent"
                          : "text-ink-700 hover:text-foreground lg:border-transparent",
                      )}
                    >
                      <span className="font-mono text-[13px] text-ink-500">0{i + 1}</span>
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        {/* ---------- reading column ---------- */}
        <article className="min-w-0 lg:col-span-8 lg:col-start-5">
          <Section id="g-account" n={1} title="Getting an account">
            <p>
              There is <strong className="font-medium text-foreground">no public sign-up</strong>.
              Students ask for an account through the request form, and the capstone coordinator
              approves it.
            </p>
            <ol className="mt-5 space-y-3">
              {[
                <>
                  Fill in the{" "}
                  <button type="button" onClick={() => navigate({ name: "account-request" })} className={inlineLink}>
                    account request form
                  </button>{" "}
                  with your student ID, name, capstone round and professor.
                </>,
                <>The coordinator reviews and approves the request, usually within a day or two.</>,
                <>
                  Your sign-in details are emailed to{" "}
                  <code className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground break-all">
                    yourStudentNumber@{UNIVERSITY.domain}
                  </code>
                  .
                </>,
                <>Sign in with your student ID, then change the generated password in Account settings.</>,
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-up-border-strong font-mono text-[12px] text-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0">{item}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="g-submit" n={2} title="Submitting a project">
            <p>
              The team leader submits on behalf of the team, one project per team. Have these ready
              before you start:
            </p>
            <ul className="mt-5 divide-y divide-up-border rounded-[16px] border border-up-border bg-card">
              {CHECKLIST.map((c) => (
                <li key={c} className="flex items-start gap-3 px-4 py-3">
                  <Check className="mt-1 size-4 shrink-0 text-primary-700" aria-hidden />
                  <span className="min-w-0">{c}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5">
              You can save a <strong className="font-medium text-foreground">draft</strong> at any
              point and keep editing. Only <strong className="font-medium text-foreground">published</strong>{" "}
              projects appear in the showcase, and publishing takes one click from the project page.
            </p>
          </Section>

          <Section id="g-verify" n={3} title="Verification">
            <p>
              The <strong className="font-medium text-foreground">verified badge</strong> means a
              professor has reviewed the published project and confirms the work. It appears on the
              project card everywhere in the showcase.
            </p>
            <p className="mt-4">
              Request it from the project page once the project is published. The professor of your
              section approves it or sends it back with a note. If you disagree with the outcome,
              talk to your professor first; the office only steps in for exceptional cases.
            </p>
          </Section>

          <Section id="g-timeline" n={4} title="Semester timeline">
            <ol className="grid gap-px overflow-hidden rounded-[16px] border border-up-border bg-up-border sm:grid-cols-2">
              {TIMELINE.map((t) => (
                <li key={t.title} className="bg-card p-5">
                  <p className="font-mono text-[13px] text-primary-700">{t.when}</p>
                  <p className="mt-2 font-medium text-foreground">{t.title}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-700">{t.body}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="g-faq" n={5} title="Questions">
            <dl>
              {FAQS.map((f) => (
                <div key={f.q} className="border-b border-up-border py-5 first:pt-0 last:border-b-0">
                  <dt className="font-medium text-foreground">{f.q}</dt>
                  <dd className="mt-1.5">{f.a}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <p className="pt-8 text-[15px] text-ink-700">
            {user ? (
              <>
                Check your{" "}
                <button type="button" onClick={() => navigate({ name: "dashboard" })} className={inlineLink}>
                  dashboard
                </button>{" "}
                for deadlines, or{" "}
                <button type="button" onClick={() => navigate({ name: "projects" })} className={inlineLink}>
                  browse published projects
                </button>
                .
              </>
            ) : (
              <>
                Next:{" "}
                <button type="button" onClick={() => navigate({ name: "account-request" })} className={inlineLink}>
                  request an account
                </button>
                , or{" "}
                <button type="button" onClick={() => navigate({ name: "projects" })} className={inlineLink}>
                  browse published projects
                </button>
                .
              </>
            )}
          </p>
        </article>
      </div>
    </>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="scroll-mt-[104px] border-b border-up-border py-10 first:pt-0 last:border-b-0"
    >
      <p className="font-mono text-[13px] text-ink-500">0{n}</p>
      <h2 id={`${id}-h`} className="mt-2 text-[26px] leading-tight text-foreground md:text-[30px]">
        {title}
      </h2>
      <div className="mt-5 max-w-[68ch] text-base leading-7 text-ink-700">{children}</div>
    </section>
  );
}
