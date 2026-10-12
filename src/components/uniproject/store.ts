"use client";

import { create } from "zustand";
import type { SafeUserDTO } from "@/lib/types";

type AuthMode = "login" | "register";

type AppState = {
  user: SafeUserDTO | null;
  authLoaded: boolean;
  authModal: AuthMode | null;
  searchOpen: boolean;
  /** Unread notification count — shared so the header badge stays in sync with the notifications view. */
  unreadNotifs: number;
  setUser: (u: SafeUserDTO | null) => void;
  setAuthLoaded: (v: boolean) => void;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  setSearchOpen: (v: boolean) => void;
  setUnreadNotifs: (v: number | ((prev: number) => number)) => void;
};

export const useAppStore = create<AppState>((set) => ({
  user: null,
  authLoaded: false,
  authModal: null,
  searchOpen: false,
  unreadNotifs: 0,
  // signing out also clears the bell badge so a stale count can't leak into the next session
  setUser: (user) => set((s) => ({ user, unreadNotifs: user === null ? 0 : s.unreadNotifs })),
  setAuthLoaded: (authLoaded) => set({ authLoaded }),
  openAuth: (mode = "login") => set({ authModal: mode }),
  closeAuth: () => set({ authModal: null }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setUnreadNotifs: (v) =>
    set((s) => ({ unreadNotifs: typeof v === "function" ? v(s.unreadNotifs) : v })),
}));

/** Shared helper: guest gate → open auth modal + info toast. Returns true when signed in. */
export function requireAuth(
  user: SafeUserDTO | null,
  openAuth: (mode?: AuthMode) => void
): boolean {
  if (user) return true;
  import("sonner").then(({ toast }) => toast.info("Sign in to continue"));
  openAuth("login");
  return false;
}
