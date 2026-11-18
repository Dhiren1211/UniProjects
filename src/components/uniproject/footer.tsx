"use client";

// ============================================================
// Footer - a plain directory: the university, link columns and
// the legal row. No promotional close.
// ============================================================

import { ArrowUpRight } from "lucide-react";
import { UNIVERSITY } from "@/lib/config";
import { canSubmit, requireAuth, useAppStore } from "./store";
import type { Navigate } from "./api-client";

const linkCls =
  "link inline-flex min-h-[32px] items-center gap-1 rounded text-[15px] text-ink-700 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function Column({ head, children }: { head: string; children: React.ReactNode }) {
  return (
    <nav aria-label={head} className="col-span-6 sm:col-span-4 lg:col-span-2">
      <h3 className="t-label">{head}</h3>
      <ul className="mt-4 space-y-1.5">{children}</ul>
    </nav>
  );
}

export function Footer({ navigate }: { navigate: Navigate }) {
  const user = useAppStore((s) => s.user);

  const submit = () => {
    const { user: current, openAuth } = useAppStore.getState();
    if (!requireAuth(current, openAuth)) return;
    navigate({ name: "create" });
  };

  const explore = [
    { label: "About", go: () => navigate({ name: "home" }) },
    { label: "Projects", go: () => navigate({ name: "projects" }) },
    { label: "Announcements", go: () => navigate({ name: "announcements" }) },
    { label: "Guidelines", go: () => navigate({ name: "guidelines" }) },
  ];

  const participate: { label: string; go: () => void }[] = [];
  if (user) {
    participate.push(
      { label: "Dashboard", go: () => navigate({ name: "dashboard" }) },
      { label: "My showcase", go: () => navigate({ name: "profile", username: user.username }) },
    );
  } else {
    participate.push({ label: "Sign in", go: () => useAppStore.getState().openAuth("login") });
  }
  if (canSubmit(user)) participate.push({ label: "Submit a project", go: submit });
  if (user) {
    participate.push(
      { label: "Account settings", go: () => navigate({ name: "settings" }) },
      { label: "Notifications", go: () => navigate({ name: "notifications" }) },
    );
  } else {
    participate.push({ label: "Request an account", go: () => navigate({ name: "account-request" }) });
  }

  const university = [
    { label: "University website", href: "https://www.ks.ac.kr" },
    { label: "Student portal", href: "https://kscms.ks.ac.kr" },
    {
      label: "Get directions",
      href: "https://www.openstreetmap.org/search?query=Kyungsung+University+Suyeong-ro+Nam-gu+Busan",
    },
  ];

  return (
    <footer id="contact" className="mt-auto border-t border-up-border bg-card" aria-label="Site footer">
      <div className="wrap pb-8 pt-12 md:pt-16">
        <div>
            <div className="grid grid-cols-12 gap-x-6 gap-y-10">
              <div className="col-span-12 lg:col-span-6">
                <img src={UNIVERSITY.logo} alt="Kyungsung University" className="h-9 w-auto dark:hidden" />
                <img src={UNIVERSITY.logoWhite} alt="Kyungsung University" className="hidden h-9 w-auto dark:block" />
                <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-ink-700">
                  The capstone design showcase of {UNIVERSITY.name}, {UNIVERSITY.location}.
                </p>
              </div>
              <Column head="Explore">
                {explore.map((item) => (
                  <li key={item.label}>
                    <button type="button" onClick={item.go} className={linkCls}>
                      {item.label}
                    </button>
                  </li>
                ))}
              </Column>
              <Column head="Take part">
                {participate.map((item) => (
                  <li key={item.label}>
                    <button type="button" onClick={item.go} className={linkCls}>
                      {item.label}
                    </button>
                  </li>
                ))}
              </Column>
              <Column head="University">
                {university.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} target="_blank" rel="noreferrer noopener" className={linkCls}>
                      {item.label}
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </a>
                  </li>
                ))}
              </Column>
            </div>

            <div className="mt-12 flex flex-col gap-2 text-[13px] text-ink-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                © {new Date().getFullYear()} {UNIVERSITY.name}
              </p>
              <p>Project photographs by the student teams</p>
            </div>
          </div>
      </div>
    </footer>
  );
}
