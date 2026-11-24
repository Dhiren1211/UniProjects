"use client";

import { useEffect, useState } from "react";
import { ArrowRight, GraduationCap, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { login, requestPasswordReset } from "./api-client";
import type { Navigate } from "./api-client";
import { useAppStore } from "./store";

export function AuthModal({ navigate }: { navigate: Navigate }) {
  const { authModal, closeAuth, setUser } = useAppStore();
  const [mode, setMode] = useState<"login" | "forgot" | "forgot-sent">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  // fresh start every time the modal closes
  useEffect(() => {
    if (authModal === null) {
      setMode("login");
      setBusy(false);
      setError(null);
      setEmail("");
      setSentMessage(null);
    }
  }, [authModal]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const loginVal = String(fd.get("login") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!loginVal || !password) {
      setError("Enter your username/email and password");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await login({ login: loginVal, password });
      setUser(user);
      toast.success(`Welcome back, ${user.displayName.split(" ")[0]}!`);
      closeAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your student ID or username");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await requestPasswordReset(email.trim());
      setSentMessage(res.message);
      setMode("forgot-sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset email");
    } finally {
      setBusy(false);
    }
  };

  const goBackToLogin = () => {
    setMode("login");
    setError(null);
  };

  const goToAccountRequest = () => {
    closeAuth();
    navigate({ name: "account-request" });
  };

  return (
    <Dialog open={authModal !== null} onOpenChange={(v) => (!v ? closeAuth() : null)}>
      <DialogContent className="sm:max-w-md">
        {mode === "login" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="size-4" aria-hidden />
                </span>
                Sign in to UniProjects
              </DialogTitle>
              <DialogDescription>
                Sign in to follow projects, join teams, and submit your capstone.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleLogin} className="mt-2 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="am-login">Username or student ID</Label>
                <Input id="am-login" name="login" placeholder="Student number or username" autoComplete="username" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="am-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                    }}
                    className="text-xs font-medium text-primary-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <PasswordInput
                  id="am-password"
                  name="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
              {error ? (
                <p aria-live="polite" className="text-xs font-medium text-danger">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy} className="w-full font-semibold">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Sign in"}
              </Button>

              <div className="flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-up-border" />
                <span className="text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground">
                  No account?
                </span>
                <span className="h-px flex-1 bg-up-border" />
              </div>
              <button
                type="button"
                onClick={goToAccountRequest}
                className="group flex w-full items-center justify-between gap-2 rounded-xl border border-up-border bg-surface-muted/60 px-4 py-3 text-left text-sm font-medium text-foreground outline-none transition-colors hover:border-primary/40 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>
                  Students can&apos;t self-register -{" "}
                  <span className="font-semibold text-primary-700">request an account</span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-primary-700 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            </form>
          </>
        ) : null}

        {mode === "forgot" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="size-4" aria-hidden />
                </span>
                Reset your password
              </DialogTitle>
              <DialogDescription>
                Enter your student ID (or username for staff). The capstone office will email a
                new password to your university address.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleForgot} className="mt-2 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="am-forgot-email">Student ID or username</Label>
                <Input
                  id="am-forgot-email"
                  name="login"
                  type="text"
                  required
                  placeholder="e.g. 2025123456"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error ? (
                <p aria-live="polite" className="text-xs font-medium text-danger">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy} className="w-full font-semibold">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Request a new password"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={goBackToLogin}
                disabled={busy}
                className="w-full"
              >
                Back to sign in
              </Button>
            </form>
          </>
        ) : null}

        {mode === "forgot-sent" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GraduationCap className="size-4" aria-hidden />
                </span>
                Request sent
              </DialogTitle>
              <DialogDescription>
                Your current password still works until the office resets it.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 space-y-4">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                <MailCheck className="size-6" aria-hidden />
              </span>
              <p
                aria-live="polite"
                className="text-center text-sm font-medium leading-relaxed text-foreground"
              >
                {sentMessage}
              </p>
              <p className="rounded-xl bg-surface-muted px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Students sign in with their student number and staff with their username. If you
                remember your password in the meantime, just sign in as usual.
              </p>
              <Button type="button" onClick={goBackToLogin} className="w-full font-semibold">
                Back to sign in
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
