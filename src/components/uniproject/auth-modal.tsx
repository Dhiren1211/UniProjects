"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Loader2,
  MailCheck,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { isEducationEmail, EDU_EMAIL_HINT } from "@/lib/edu-email";
import { login, register, requestEmailCode, verifyEmailCode } from "./api-client";
import { useAppStore } from "./store";

export function AuthModal() {
  const { authModal, closeAuth, setUser, openAuth } = useAppStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  // ---- email verification flow (register tab) ----
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const emailOk = isEducationEmail(email);
  const emailBad = email.trim().length > 3 && !emailOk;
  const pwMatch = password.length > 0 && confirm === password;

  // resend cooldown ticker
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // fresh start every time the modal closes
  useEffect(() => {
    if (authModal === null) {
      setStep("form");
      setEmail("");
      setSentTo("");
      setCode("");
      setDevCode(null);
      setError(null);
      setResendIn(0);
      setBusy(false);
      setCodeBusy(false);
      setResending(false);
    }
  }, [authModal]);

  const handleGoogle = () => {
    // Server route: real Google OAuth when credentials exist, demo sign-in otherwise.
    setGoogleBusy(true);
    window.location.assign("/api/auth/google");
  };

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

  // Step 1 "Verify email" → sends the code. Step 2 "Verify & create" → confirms
  // the code and creates the account (the API rejects any register attempt
  // without the single-use token minted by the verification step).
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (step === "form") {
      const username = String(fd.get("username") ?? "").trim();
      const displayName = String(fd.get("displayName") ?? "").trim();
      const emailVal = String(fd.get("email") ?? "").trim();
      const pw = String(fd.get("password") ?? "");
      const confirmValue = String(fd.get("confirmPassword") ?? "");

      if (!username || !displayName) {
        setError("Enter your username and full name");
        return;
      }
      if (!emailVal) {
        setError("Enter your university email");
        return;
      }
      if (!isEducationEmail(emailVal)) {
        setError(EDU_EMAIL_HINT);
        return;
      }
      if (pw.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (pw !== confirmValue) {
        setError("Passwords don't match — please check both fields");
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const r = await requestEmailCode({ email: emailVal });
        setSentTo(emailVal.toLowerCase());
        setDevCode(r.devCode ?? null);
        setCode("");
        setStep("code");
        setResendIn(r.cooldownSeconds ?? 60);
        toast.success(`Verification code sent to ${emailVal}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send the code");
      } finally {
        setBusy(false);
      }
      return;
    }

    // ---- step: code ----
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setCodeBusy(true);
    setError(null);
    try {
      const v = await verifyEmailCode({ email: sentTo, code });
      const user = await register({
        username: String(fd.get("username") ?? "").trim(),
        displayName: String(fd.get("displayName") ?? "").trim(),
        email: sentTo,
        password: String(fd.get("password") ?? ""),
        verifyToken: v.verifyToken,
      });
      setUser(user);
      toast.success(
        `Welcome to UniProjects, ${user.displayName.split(" ")[0]}! Email verified ✓`
      );
      closeAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setCodeBusy(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const r = await requestEmailCode({ email: sentTo });
      setDevCode(r.devCode ?? null);
      setCode("");
      setResendIn(r.cooldownSeconds ?? 60);
      toast.success(`New code sent to ${sentTo}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code");
    } finally {
      setResending(false);
    }
  };

  const goBackToForm = () => {
    setStep("form");
    setCode("");
    setDevCode(null);
    setError(null);
  };

  const fieldErr = error ? (
    <p className="mt-2 text-xs font-medium text-danger">{error}</p>
  ) : null;

  return (
    <Dialog open={authModal !== null} onOpenChange={(v) => (!v ? closeAuth() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
              <GraduationCap className="size-4" aria-hidden />
            </span>
            Join UniProjects
          </DialogTitle>
          <DialogDescription>
            Sign in to submit projects, join teams, and join the campus conversation.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue={authModal ?? "login"}
          onValueChange={(v) => openAuth(v as "login" | "register")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="register">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="mt-2 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="am-login">Username or email</Label>
                <Input id="am-login" name="login" placeholder="Eg. dhiren" autoComplete="username" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="am-password">Password</Label>
                <Input
                  id="am-password"
                  name="password"
                  type="password"
                  placeholder="*********"
                  autoComplete="current-password"
                />
              </div>
              {fieldErr}
              <Button type="submit" disabled={busy} className="w-full font-semibold">
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Sign in"}
              </Button>
              <GoogleDivider />
              <Button
                type="button"
                variant="outline"
                disabled={googleBusy}
                onClick={handleGoogle}
                className="w-full rounded-xl font-semibold"
              >
                {googleBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </Button>
              {/* <p className="rounded-xl bg-surface-muted px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Demo accounts:</span> any seeded
                user — e.g. <code className="font-mono">jisoo.park</code>,{" "}
                <code className="font-mono">gun.woo</code>,{" "}
                <code className="font-mono">jiwoo.han</code> (admin) · password{" "}
                <code className="font-mono">demo1234</code>
              </p> */}
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="mt-2 space-y-4">
              {/* ---- step 1 · account details (kept mounted & hidden during the code step) ---- */}
              <div className={cn("space-y-4", step !== "form" && "hidden")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="am-username">Username</Label>
                    <Input id="am-username" name="username" placeholder=" Eg. dhiren" autoComplete="off" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="am-display">Full name</Label>
                    <Input id="am-display" name="displayName" placeholder="Eg. Kathayat Dhiren" autoComplete="name" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="am-email">University email</Label>
                  <Input
                    id="am-email"
                    name="email"
                    type="email"
                    placeholder="2025000000@ks.ac.kr"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    aria-invalid={emailBad}
                    className={cn(emailBad && "border-danger focus-visible:ring-danger/30")}
                  />
                  {email.trim() ? (
                    emailOk ? (
                      <p className="flex items-center gap-1 text-xs font-medium text-primary-700" aria-live="polite">
                        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
                        Education email — ready to verify
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-danger" aria-live="polite">
                        Only education emails (e.g. <span className="font-mono">@ks.ac.kr</span>,{" "}
                        <span className="font-mono">.edu</span>) can register
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll send a 6-digit verification code to this address.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="am-new-password">Password</Label>
                  <Input
                    id="am-new-password"
                    name="password"
                    type="password"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="am-confirm-password">Confirm password</Label>
                  <Input
                    id="am-confirm-password"
                    name="confirmPassword"
                    type="password"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    aria-invalid={confirm.length > 0 && !pwMatch}
                  />
                  {confirm.length > 0 ? (
                    <p
                      className={cn(
                        "text-xs font-medium",
                        pwMatch ? "text-primary-700" : "text-danger"
                      )}
                      aria-live="polite"
                    >
                      {pwMatch ? "✓ Passwords match" : "Passwords don't match yet"}
                    </p>
                  ) : null}
                </div>
              </div>

              {step === "form" ? (
                <>
                  {fieldErr}
                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full font-semibold"
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        Verify email
                        <ArrowRight className="size-4" aria-hidden />
                      </>
                    )}
                  </Button>
                  <GoogleDivider />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={googleBusy}
                    onClick={handleGoogle}
                    className="w-full rounded-xl font-semibold"
                  >
                    {googleBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <GoogleIcon />
                    )}
                    Sign up with Google
                  </Button>
                </>
              ) : (
                <>
                  {/* ---- step 2 · verification code ---- */}
                  <div className="flex items-start gap-2.5 rounded-xl bg-primary-50 px-3.5 py-3">
                    <MailCheck className="mt-0.5 size-4 shrink-0 text-primary-700" aria-hidden />
                    <p className="text-xs leading-relaxed text-primary-800">
                      We sent a 6-digit code to{" "}
                      <span className="font-semibold text-foreground">{sentTo}</span>. Enter it
                      below to verify your email and create your account.
                    </p>
                  </div>

                  <OtpInput
                    value={code}
                    onChange={(v) => {
                      setCode(v);
                      if (error) setError(null);
                    }}
                    disabled={codeBusy}
                  />

                  {devCode ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/50 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">
                      <p>
                        <span className="font-semibold">Demo mode</span> — no mail server is
                        attached in this sandbox, so your code is{" "}
                        <code className="font-mono text-sm font-bold tracking-widest">
                          {devCode}
                        </code>
                      </p>
                      <button
                        type="button"
                        onClick={() => setCode(devCode)}
                        className="shrink-0 rounded-lg bg-amber-400/30 px-2.5 py-1 font-semibold text-amber-950 transition-colors hover:bg-amber-400/50"
                      >
                        Fill
                      </button>
                    </div>
                  ) : null}

                  {fieldErr}

                  <Button
                    type="submit"
                    disabled={codeBusy || code.length !== 6}
                    className="w-full font-semibold"
                  >
                    {codeBusy ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <>
                        <ShieldCheck className="size-4" aria-hidden />
                        Verify &amp; create account
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={goBackToForm}
                      className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ArrowLeft className="size-3.5" aria-hidden />
                      Wrong email? Go back
                    </button>
                    {resendIn > 0 ? (
                      <span className="text-muted-foreground">Resend code in {resendIn}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="inline-flex items-center gap-1 font-semibold text-primary-700 transition-colors hover:text-primary-800 disabled:opacity-60"
                      >
                        {resending ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        ) : (
                          <RotateCw className="size-3.5" aria-hidden />
                        )}
                        Resend code
                      </button>
                    )}
                  </div>
                </>
              )}
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** 6-box one-time-code input: auto-advance, backspace, arrows, paste. */
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const setDigit = (i: number, d: string) => {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).slice(0, 6);
    onChange(next);
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          className="h-12 w-full rounded-xl border border-up-border bg-card text-center text-lg font-bold tracking-tight text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring disabled:opacity-50"
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            setDigit(i, raw ? raw[raw.length - 1] : "");
            if (raw && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              if (d) {
                setDigit(i, "");
              } else if (i > 0) {
                onChange(value.slice(0, i));
                refs.current[i - 1]?.focus();
              }
            }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (pasted) {
              onChange(pasted);
              refs.current[Math.min(pasted.length, 5)]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}

/** Thin “or” divider above the Google button. */
function GoogleDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-up-border" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        or
      </span>
      <span className="h-px flex-1 bg-up-border" />
    </div>
  );
}

/** Official multicolor Google “G”. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
