"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  FolderKanban,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  MessagesSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  User as UserIcon,
  UserRound,
  Users,
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
import { useAppStore } from "./store";

const NAV: {
  label: string;
  view: "home" | "projects" | "community" | "students";
  icon: LucideIcon;
}[] = [
  { label: "Overview", view: "home", icon: Home },
  { label: "Projects", view: "projects", icon: FolderKanban },
  { label: "Community", view: "community", icon: MessagesSquare },
  { label: "Students", view: "students", icon: Users },
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
  const { user, openAuth, setSearchOpen, setUser } = useAppStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const reduceMotion = useReducedMotion();

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
    <header className="sticky top-0 z-40 w-full border-b border-up-border bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5 md:px-8">
        {/* Brand */}
        <button
          type="button"
          onClick={() => navigate({ name: "home" })}
          className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src={UNIVERSITY.logo}
            alt="Kyungsung University"
            className="h-9 w-auto"
          />
          <span className="hidden h-5 w-px bg-up-border xl:block" aria-hidden />
          <span className="hidden flex-col items-start leading-none xl:flex">
            <span className="text-[13px] font-semibold tracking-tight text-foreground">
              Project Showcase
            </span>
            <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              {UNIVERSITY.name}
            </span>
          </span>
        </button>

        {/* Desktop nav (md–lg uses the drawer instead — brand + 4 items + actions overflow there).
            Underline indicator: the active item owns a sliding bar (shared layoutId morphs between
            buttons); non-active items draw a lighter bar in on hover. */}
        <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => {
            const isActive = active === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => navigate({ name: item.view })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center rounded-full px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "text-primary-700"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="nav-active-underline"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                    className="absolute inset-x-3.5 bottom-0 h-0.5 rounded-full bg-primary"
                    aria-hidden
                  />
                ) : (
                  <span
                    className="absolute inset-x-3.5 bottom-0 h-0.5 origin-center scale-x-0 rounded-full bg-primary/40 transition-transform duration-200 ease-out group-hover:scale-x-100"
                    aria-hidden
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-full text-muted-foreground"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Search · ⌘K</TooltipContent>
          </Tooltip>

          {user === null ? (
            /* Sign in as a circular avatar-style icon — the account entry point, tooltip for clarity */
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  aria-label="Sign in"
                  onClick={() => openAuth("login")}
                  whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                  className="flex size-9 items-center justify-center rounded-full bg-primary text-white shadow-sm outline-none transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <UserRound className="size-[18px]" aria-hidden />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Sign in</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <NotifBell navigate={navigate} />
              <UserMenu navigate={navigate} onLogout={handleLogout} />
            </>
          )}

          <span className="hidden h-5 w-px bg-up-border lg:block" aria-hidden />

          <div className="hidden lg:block">
            <Button
              onClick={onSubmitClick}
              className="h-9 gap-1.5 rounded-full px-4 text-sm font-semibold"
            >
              <Plus className="size-4" aria-hidden />
              Submit project
            </Button>
          </div>

          {/* Hamburger (mobile / tablet — desktop nav owns lg+) */}
          <motion.button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-controls="mobile-menu"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
            className="inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </motion.button>
        </div>
      </div>

      {/* Mobile/tablet drawer — portal to <body>: the header's backdrop-filter would otherwise become
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
                    className="absolute inset-0 cursor-default bg-ink-900/40 backdrop-blur-sm"
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
                    className="absolute right-0 top-0 flex h-full w-[300px] max-w-[85vw] flex-col bg-white shadow-float"
                  >
                    {/* Drawer header */}
                    <div className="flex h-16 shrink-0 items-center justify-between border-b border-up-border px-5">
                      <img
                        src={UNIVERSITY.logo}
                        alt="Kyungsung University"
                        className="h-8 w-auto"
                      />
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
                          {NAV.map((item) => {
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
                                    ? "flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-primary-50 px-3 py-2.5 text-[15px] font-semibold text-primary-700 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    : "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-muted-foreground outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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

                        {user?.role === "ADMIN" ? (
                          <motion.button
                            type="button"
                            variants={drawerItem}
                            onClick={() => navFromDrawer({ name: "admin" })}
                            aria-current={
                              active === "admin" ? "page" : undefined
                            }
                            className="mt-2 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-muted-foreground outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <LayoutDashboard
                              className="size-[18px]"
                              aria-hidden
                            />
                            Admin panel
                          </motion.button>
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
                      <div className="shrink-0 border-t border-up-border px-4 py-4">
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
    // NotifBell is only mounted while signed in — it seeds the shared count on entry.
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
              className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white"
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
  const isStaff = user.role === "FACULTY" || user.role === "ADMIN";

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
        <DropdownMenuItem onClick={() => navigate({ name: "settings" })}>
          <Settings className="size-4" aria-hidden />
          Settings
        </DropdownMenuItem>
        {isStaff ? (
          <DropdownMenuItem onClick={() => navigate({ name: "moderation" })}>
            <ShieldCheck className="size-4" aria-hidden />
            Moderation
          </DropdownMenuItem>
        ) : null}
        {user.role === "ADMIN" ? (
          <DropdownMenuItem onClick={() => navigate({ name: "admin" })}>
            <LayoutDashboard className="size-4" aria-hidden />
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
