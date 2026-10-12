"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  fetchMe,
  type Navigate,
  type View,
} from "./api-client";
import { AuthModal } from "./auth-modal";
import { Footer } from "./footer";
import { Header } from "./header";
import { SearchDialog } from "./search-dialog";
import { useAppStore } from "./store";
import { CreateProjectView } from "./views/create";
import { DetailView } from "./views/detail";
import { HomeView } from "./views/home";
import { AdminView } from "./views/admin";
import { CommunityView } from "./views/community";
import { ModerationView } from "./views/moderation";
import { NotificationsView } from "./views/notifications";
import { ProfileView } from "./views/profile";
import { ProjectsView } from "./views/projects";
import { SettingsView } from "./views/settings";
import { StudentsView } from "./views/students";

export function UniProjectApp() {
  const { setUser, setAuthLoaded } = useAppStore();

  // hydrate the session once on mount; explain Google sign-in redirects afterwards,
  // when the UI is fully mounted (mount-time toasts can be swallowed by hydration)
  useEffect(() => {
    const ac = new AbortController();
    fetchMe(ac.signal)
      .then((u) => {
        setUser(u);
        setAuthLoaded(true);
      })
      .catch(() => setAuthLoaded(true))
      .finally(() => {
        // Google sign-in lands back on /?google=demo|error — explain, then clean the URL.
        const google = new URLSearchParams(window.location.search).get("google");
        if (google === "demo") {
          toast.info(
            "Signed in with Google — demo mode (OAuth isn't configured on this deployment)"
          );
          window.history.replaceState(null, "", window.location.pathname);
        } else if (google === "error") {
          toast.error("Google sign-in failed. Please try again.");
          window.history.replaceState(null, "", window.location.pathname);
        }
      });
    return () => ac.abort();
  }, []);

  return <AppBody />;
}

function AppBody() {
  const [view, setView] = useState<View>({ name: "home" });
  const reduceMotion = useReducedMotion();

  const navigate: Navigate = (v) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  const active =
    view.name === "project"
      ? "projects"
      : view.name === "profile" || view.name === "settings"
        ? "students"
        : view.name;

  const openSubmit = () => {
    const { user, openAuth } = useAppStore.getState();
    if (!user) {
      import("sonner").then(({ toast }) => toast.info("Sign in to submit a project"));
      openAuth("login");
      return;
    }
    navigate({ name: "create" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header navigate={navigate} active={active} onSubmitClick={openSubmit} />

      <main className="flex-1">
        {/* View switch choreography: old view fades/lifts out, new one settles in.
            Keyed by view identity (name + slug/username/editSlug) so navigating between two
            projects re-animates, but unrelated store churn (toasts etc.) doesn't. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={viewKey(view)}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={
              reduceMotion
                ? { opacity: 0, transition: { duration: 0.1 } }
                : { opacity: 0, y: -6, transition: { duration: 0.15, ease: "easeIn" } }
            }
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {view.name === "home" ? <HomeView navigate={navigate} /> : null}
            {view.name === "projects" ? (
              <ProjectsView key={projectKey(view)} initial={view} navigate={navigate} />
            ) : null}
            {view.name === "project" ? (
              <DetailView key={view.slug} slug={view.slug} navigate={navigate} />
            ) : null}
            {view.name === "community" ? <CommunityView navigate={navigate} /> : null}
            {view.name === "students" ? <StudentsView navigate={navigate} /> : null}
            {view.name === "profile" ? (
              <ProfileView key={view.username} username={view.username} navigate={navigate} />
            ) : null}
            {view.name === "settings" ? <SettingsView navigate={navigate} /> : null}
            {view.name === "notifications" ? <NotificationsView navigate={navigate} /> : null}
            {view.name === "moderation" ? <ModerationView navigate={navigate} /> : null}
            {view.name === "admin" ? <AdminView navigate={navigate} /> : null}
            {view.name === "create" ? (
              <CreateProjectView key={view.editSlug ?? "new"} editSlug={view.editSlug} navigate={navigate} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* The admin console and the submit wizard are focused workspaces — no marketing footer. */}
      {view.name !== "admin" && view.name !== "create" ? <Footer navigate={navigate} /> : null}
      <AuthModal />
      <SearchDialog navigate={navigate} />
    </div>
  );
}

function projectKey(v: Extract<View, { name: "projects" }>) {
  return `${v.q ?? ""}|${v.dept ?? ""}|${v.category ?? ""}|${v.year ?? ""}`;
}

/** Stable per-view key for the AnimatePresence wrapper (filters inside "projects" don't re-animate). */
function viewKey(v: View): string {
  switch (v.name) {
    case "project":
      return `project:${v.slug}`;
    case "profile":
      return `profile:${v.username}`;
    case "create":
      return `create:${v.editSlug ?? "new"}`;
    default:
      return v.name;
  }
}
