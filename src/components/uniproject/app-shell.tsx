"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  fetchMe,
  fetchSettings,
  type Navigate,
  type View,
} from "./api-client";
import { AuthModal } from "./auth-modal";
import { Footer } from "./footer";
import { Header } from "./header";
import { SearchDialog } from "./search-dialog";
import { useAppStore } from "./store";
import { locationToView, viewTitle, viewToPath } from "./routes";
import { CreateProjectView } from "./views/create";
import { DetailView } from "./views/detail";
import { HomeView } from "./views/home";
import { AdminView } from "./views/admin";
import { AnnouncementsView } from "./views/announcements";
import { GuidelinesView } from "./views/guidelines";
import { DashboardView } from "./views/dashboard";
import { AccountRequestView } from "./views/account-request";
import { NotificationsView } from "./views/notifications";
import { ProfileView } from "./views/profile";
import { ProjectsView } from "./views/projects";
import { SettingsView } from "./views/settings";

export function UniProjectApp({ initial }: { initial?: View }) {
  const { setUser, setAuthLoaded, setSettings } = useAppStore();

  // hydrate the session + public site settings once on mount
  useEffect(() => {
    const ac = new AbortController();
    fetchMe(ac.signal)
      .then((u) => {
        setUser(u);
        setAuthLoaded(true);
      })
      .catch(() => setAuthLoaded(true));
    fetchSettings(ac.signal)
      .then(setSettings)
      .catch(() => {});
    return () => ac.abort();
  }, []);

  return <AppBody initial={initial ?? { name: "home" }} />;
}

function AppBody({ initial }: { initial: View }) {
  const [view, setView] = useState<View>(initial);
  const reduceMotion = useReducedMotion();
  const siteName = useAppStore((s) => s.settings?.siteName) || "Capstone Contest";

  // Every view has a real URL: push it on navigation, follow Back / Forward.
  const navigate: Navigate = (v) => {
    const url = viewToPath(v);
    if (url !== window.location.pathname + window.location.search) {
      window.history.pushState(null, "", url);
    }
    setView(v);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onPop = () => setView(locationToView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    document.title = viewTitle(view, siteName);
  }, [view, siteName]);

  const active =
    view.name === "project"
      ? "projects"
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

        {/* View switch choreography: old view fades/lifts out, new one settles in.
            Keyed by view identity (name + slug/username/editSlug) so navigating between two
            projects re-animates, but unrelated store churn (toasts etc.) doesn't. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={viewKey(view)}
            id="main"
            className="flex-1"
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
            {view.name === "announcements" ? <AnnouncementsView /> : null}
            {view.name === "guidelines" ? <GuidelinesView navigate={navigate} /> : null}
            {view.name === "account-request" ? <AccountRequestView navigate={navigate} /> : null}
            {view.name === "dashboard" ? <DashboardView navigate={navigate} /> : null}
            {view.name === "profile" ? (
              <ProfileView key={view.username} username={view.username} navigate={navigate} />
            ) : null}
            {view.name === "settings" ? <SettingsView navigate={navigate} /> : null}
            {view.name === "notifications" ? <NotificationsView navigate={navigate} /> : null}
            {view.name === "admin" ? <AdminView navigate={navigate} initialTab={view.tab} /> : null}
            {view.name === "create" ? (
              <CreateProjectView key={view.editSlug ?? "new"} editSlug={view.editSlug} navigate={navigate} />
            ) : null}
          </motion.main>
        </AnimatePresence>

      {/* The admin console and the submit wizard are focused workspaces - no marketing footer. */}
      {view.name !== "admin" && view.name !== "create" ? <Footer navigate={navigate} /> : null}
      <AuthModal navigate={navigate} />
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
