"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  BookOpen,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  User as UserIcon,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { UNIVERSITY } from "@/lib/config";
import {
  logout,
  fetchNotifications,
  type Navigate,
  type View,
} from "./api-client";
import { UserAvatar } from "./ui-bits";
import { ThemeToggle } from "./theme-toggle";
import { canSubmit, useAppStore } from "./store";

type NavView = "home" | "projects" | "announcements" | "guidelines" | "dashboard";

const NAV: {
  label: string;
  view: NavView;
  icon: LucideIcon;
  signedInOnly?: boolean;
}[] = [
  { label: "About", view: "home", icon: BookOpen },
  { label: "Projects", view: "projects", icon: FolderKanban },
  { label: "Announcements", view: "announcements", icon: Megaphone },
  { label: "Guidelines", view: "guidelines", icon: ClipboardList },
  { label: "Dashboard", view: "dashboard", icon: LayoutDashboard, signedInOnly: true },
];

// drawer entrance: rows fade-slide in, staggered
const drawerList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
};
const drawerItem: Variants = {
  hidden: { opacity: 0, x: 18 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 380, damping: 32 },
  },
};

export function Header({
  navigate,
  active,
  onSubmitClick,
}: {
  navigate: Navigate;
  active: string;
  onSubmitClick: () => void;
}) {
  const { user, openAuth, setSearchOpen, setUser, settings } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const reduceMotion = useReducedMotion();
  // Global search toggle (requirement 2) - hidden entirely when the site disables it.
  const searchEnabled = settings?.searchEnabled !== false;

  // Visible nav: public items + Dashboard once signed in.
  const navItems = NAV.filter((item) => !item.signedInOnly || user);

  const closeMenu = () => setMenuOpen(false);

  // navigate from the drawer → close it first, then switch views
  const navFromDrawer: Navigate = (v: View) => {
    setMenuOpen(false);
    navigate(v);
  };

  const handleLogout = async () => {
    await logout().catch(() => {});
    setUser(null);
    navigate({ name: "home" });
  };

  // Escape closes the drawer + body scroll stays locked while it is open
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  // move focus into the drawer once it mounts; hand it back to the hamburger on close
  useEffect(() => {
    if (menuOpen) {
      wasOpenRef.current = true;
      const t = setTimeout(() => closeBtnRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      menuBtnRef.current?.focus();
    }
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-up-border bg-background">
      <div className="wrap flex h-14 items-center justify-between gap-6 md:h-[72px]">
        {/* The client's own logo (the crest carries the wordmark) on the left line */}
        <button
          type="button"
          onClick={() => navigate({ name: "home" })}
          aria-label="Capstone Contest, Kyungsung University: home"
          className="flex shrink-0 items-center rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <img src={UNIVERSITY.logo} alt="" className="h-8 w-auto md:h-9 dark:hidden" />
          <img src={UNIVERSITY.logoWhite} alt="" className="hidden h-8 w-auto md:h-9 dark:block" />
        </button>

        {/* Main nav: plain one-word links */}
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const isActive = active === item.view;
            return (
              <div key={item.view} className="relative">
                <button
                  type="button"
                  onClick={() => navigate({ name: item.view })}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center gap-1 whitespace-nowrap rounded-lg px-3 text-[1rem] font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    isActive ? "text-foreground" : "text-ink-700 hover:text-foreground",
                  )}
                >
                  {item.label}
                  {isActive ? (
                    <span className="absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-primary" aria-hidden />
                  ) : null}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Actions: search, account, then the one primary on the right line */}
        <div className="flex items-center gap-1">
          {searchEnabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 rounded-lg text-ink-700"
                  aria-label="Search projects"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="size-[18px]" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search · ⌘K</TooltipContent>
            </Tooltip>
          ) : null}

          <ThemeToggle />

          {user === null ? (
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="hidden h-11 items-center rounded-lg px-3 text-[1rem] font-medium text-ink-700 outline-none transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:flex"
            >
              Sign in
            </button>
          ) : (
            <>
              <NotifBell navigate={navigate} />
              <UserMenu navigate={navigate} onLogout={handleLogout} />
            </>
          )}

          {canSubmit(user) ? (
            <div className="ml-2 hidden lg:block">
              <Button onClick={onSubmitClick} className="h-10 gap-1.5 px-4 text-[1rem]">
                <Plus className="size-4" aria-hidden />
                Submit project
              </Button>
            </div>
          ) : null}

          {/* Menu button (phone and tablet), the secondary look */}
          <motion.button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-controls="mobile-menu"
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            className="ml-1 inline-flex size-11 items-center justify-center rounded-[10px] border border-up-border-strong text-foreground outline-none transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </motion.button>
        </div>
      </div>

      {/* Mobile/tablet drawer - portal to <body>: the header's backdrop-filter would otherwise become
          the containing block for this fixed overlay and squash it into the 64px header strip.
          AnimatePresence lives INSIDE the portal so its exit animations keep working, and the
          typeof-document guard keeps SSR (no portals on the server) happy. */}
      {typeof document === "undefined"
        ? null
        : createPortal(
            <AnimatePresence>
              {menuOpen ? (
                <div id="mobile-menu" className="fixed inset-0 z-50 lg:hidden">
                  <motion.button
                    type="button"
                    aria-label="Close menu"
                    onClick={closeMenu}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 cursor-default bg-black/60"
                  />
                  <motion.aside
                    role="dialog"
                    aria-modal="true"
                    aria-label="Site menu"
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", stiffness: 320, damping: 34 }}
                    drag={reduceMotion ? false : "x"}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ left: 0, right: 0.3 }}
                    dragMomentum={false}
                    onDragEnd={(_, info) => {
                      if (info.offset.x > 80 || info.velocity.x > 420)
                        closeMenu();
                    }}
                    className="absolute right-0 top-0 flex h-full w-[300px] max-w-[85vw] flex-col bg-card shadow-float"
                  >
                    {/* Drawer header */}
                    <div className="flex h-16 shrink-0 items-center justify-between border-b border-up-border px-5">
                      <img src={UNIVERSITY.logo} alt="Kyungsung University" className="h-8 w-auto dark:hidden" />
                      <img src={UNIVERSITY.logoWhite} alt="Kyungsung University" className="hidden h-8 w-auto dark:block" />
                      <button
                        ref={closeBtnRef}
                        type="button"
                        onClick={closeMenu}
                        aria-label="Close menu"
                        className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="size-5" aria-hidden />
                      </button>
                    </div>

                    {/* Drawer body */}
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                      <motion.div
                        variants={drawerList}
                        initial="hidden"
                        animate="show"
                      >
                        <nav aria-label="Mobile" className="space-y-1">
                          {navItems.map((item) => {
                            const isActive = active === item.view;
                            return (
                              <motion.button
                                key={item.view}
                                type="button"
                                variants={drawerItem}
                                onClick={() =>
                                  navFromDrawer({ name: item.view })
                                }
                                aria-current={isActive ? "page" : undefined}
                                className={
                                  isActive
                                    ? "flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-primary-50 px-3 py-2.5 text-[1rem] font-semibold text-primary-700 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    : "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[1rem] font-medium text-muted-foreground outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                }
                              >
                                <item.icon
                                  className="size-[18px]"
                                  aria-hidden
                                />
                                {item.label}
                              </motion.button>
                            );
                          })}
                        </nav>

                        {canSubmit(user) ? (
                          <>
                            <motion.div
                              variants={drawerItem}
                              className="my-4 border-t border-up-border"
                              aria-hidden
                            />

                            <motion.div variants={drawerItem}>
                              <Button
                                onClick={() => {
                                  setMenuOpen(false);
                                  onSubmitClick();
                                }}
                                className="h-11 w-full rounded-xl font-semibold"
                              >
                                <Plus className="size-4" aria-hidden />
                                Submit project
                              </Button>
                            </motion.div>
                          </>
                        ) : null}
                      </motion.div>
                    </div>

                    {/* Drawer footer: account */}
                    {user ? (
                      <div className="shrink-0 border-t border-up-border px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              navFromDrawer({
                                name: "profile",
                                username: user.username,
                              })
                            }
                            className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-xl px-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <UserAvatar
                              name={user.displayName}
                              avatarUrl={user.avatarUrl}
                              ring={false}
                              className="size-10"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-foreground">
                                {user.displayName}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                @{user.username}
                              </span>
                            </span>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Sign out"
                            onClick={() => {
                              setMenuOpen(false);
                              handleLogout();
                            }}
                            className="size-11 shrink-0 rounded-xl text-muted-foreground hover:text-danger"
                          >
                            <LogOut className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="shrink-0 space-y-2 border-t border-up-border px-4 py-4">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setMenuOpen(false);
                            openAuth("login");
                          }}
                          className="h-11 w-full rounded-xl font-semibold"
                        >
                          <LogIn className="size-4" aria-hidden />
                          Sign in
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => navFromDrawer({ name: "account-request" })}
                          className="h-11 w-full rounded-xl font-semibold text-primary-700 hover:bg-primary-50 hover:text-primary-800"
                        >
                          Request an account
                        </Button>
                      </div>
                    )}
                  </motion.aside>
                </div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )}
    </header>
  );
}

function NotifBell({ navigate }: { navigate: Navigate }) {
  // The unread count lives in the shared store, so marking notifications as read
  // in the notifications view updates this badge instantly (no refresh needed).
  const user = useAppStore((s) => s.user);
  const unread = useAppStore((s) => s.unreadNotifs);
  const setUnreadNotifs = useAppStore((s) => s.setUnreadNotifs);

  useEffect(() => {
    // NotifBell is only mounted while signed in - it seeds the shared count on entry.
    if (!user) return;
    const ac = new AbortController();
    fetchNotifications(ac.signal)
      .then((rows) => setUnreadNotifs(rows.filter((n) => !n.read).length))
      .catch(() => {});
    return () => ac.abort();
  }, [user, setUnreadNotifs]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-full text-muted-foreground"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          onClick={() => navigate({ name: "notifications" })}
        >
          <Bell className="size-4" aria-hidden />
          {unread > 0 ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-bold text-primary-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Notifications</TooltipContent>
    </Tooltip>
  );
}

function UserMenu({
  navigate,
  onLogout,
}: {
  navigate: Navigate;
  onLogout: () => void;
}) {
  const { user } = useAppStore();
  if (!user) return null;
  const isAdminPanel = user.role === "ADMIN" || user.role === "MODERATOR";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar
            name={user.displayName}
            avatarUrl={user.avatarUrl}
            ring={false}
            className="size-9"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="text-sm font-semibold">{user.displayName}</p>
          <p className="text-xs font-normal text-muted-foreground">
            @{user.username}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate({ name: "profile", username: user.username })}
        >
          <UserIcon className="size-4" aria-hidden />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ name: "dashboard" })}>
          <LayoutDashboard className="size-4" aria-hidden />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ name: "settings" })}>
          <Settings className="size-4" aria-hidden />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ name: "notifications" })}>
          <Bell className="size-4" aria-hidden />
          Notifications
        </DropdownMenuItem>
        {isAdminPanel ? (
          <DropdownMenuItem onClick={() => navigate({ name: "admin" })}>
            <ShieldCheck className="size-4" aria-hidden />
            Admin panel
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-danger focus:text-danger"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
