"use client";

// ============================================================
// Admin → Settings → Email delivery (SMTP).
// Saved in the database and used immediately - no redeploy.
// The password is write-only: the server never sends it back.
// ============================================================

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Mail, RotateCcw, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  fetchMailSettings,
  resetMailSettings,
  saveMailSettings,
  sendTestEmail,
  type MailSettingsDTO,
} from "./api-client";

const SOURCE_COPY: Record<MailSettingsDTO["source"], { label: string; cls: string; hint: string }> = {
  panel: {
    label: "Active - set here",
    cls: "bg-success-soft text-success",
    hint: "Email is sent with the settings below.",
  },
  env: {
    label: "Active - from .env",
    cls: "bg-info-soft text-info",
    hint: "Email uses the SMTP values in the server's environment. Saving here overrides them.",
  },
  none: {
    label: "Not configured",
    cls: "bg-warning-soft text-warning",
    hint: "Emails are only stored in Admin → Emails, not delivered. Fill in an SMTP account to send them.",
  },
};

export function MailSettingsCard() {
  const [view, setView] = useState<MailSettingsDTO | null>(null);
  const [form, setForm] = useState({ host: "", port: "465", user: "", fromName: "" });
  const [pass, setPass] = useState(""); // "" = keep the stored password
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | "reset" | null>(null);

  const hydrate = (v: MailSettingsDTO) => {
    setView(v);
    setForm({ host: v.host, port: String(v.port), user: v.user, fromName: v.fromName });
    setPass("");
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchMailSettings(ac.signal)
      .then(hydrate)
      .catch((e) => !ac.signal.aborted && toast.error(e instanceof Error ? e.message : "Could not load email settings"));
    return () => ac.abort();
  }, []);

  if (!view) return <Skeleton className="h-80 w-full rounded-2xl" />;

  const dirty =
    pass !== "" ||
    form.host !== view.host ||
    form.port !== String(view.port) ||
    form.user !== view.user ||
    form.fromName !== view.fromName;
  const source = SOURCE_COPY[view.source];

  const save = async () => {
    const port = Number(form.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.error("Enter a valid port (465 for SSL, 587 for STARTTLS)");
      return;
    }
    setBusy("save");
    try {
      hydrate(
        await saveMailSettings({
          host: form.host.trim(),
          port,
          user: form.user.trim(),
          fromName: form.fromName.trim(),
          ...(pass ? { pass } : {}),
        })
      );
      toast.success("Email settings saved - they apply right away");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy("test");
    try {
      const r = await sendTestEmail();
      if (r.delivered) toast.success(`Test email sent to ${r.to}`);
      else toast.error("The test email was not delivered - check the account and password, then try again");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the test email");
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy("reset");
    try {
      hydrate(await resetMailSettings());
      toast.success("Panel values cleared - email now uses the .env settings");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-up-border bg-card p-4 shadow-card md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Mail className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground">Email delivery</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{source.hint}</p>
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", source.cls)}>
          {source.label}
        </span>
      </div>

      {view.passwordUnreadable ? (
        <p className="mt-3 rounded-xl bg-warning-soft/60 px-3 py-2.5 text-xs leading-relaxed text-warning">
          The saved password can&apos;t be read any more (the database connection string changed).
          Enter the password again and save.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="space-y-1.5">
          <Label htmlFor="mail-host">SMTP host</Label>
          <Input
            id="mail-host"
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
            placeholder="smtp.gmail.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mail-port">Port</Label>
          <Input
            id="mail-port"
            inputMode="numeric"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            placeholder="465"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mail-user">Sending account</Label>
          <Input
            id="mail-user"
            value={form.user}
            onChange={(e) => setForm({ ...form, user: e.target.value })}
            placeholder="name@gmail.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="mail-from">Sender name</Label>
          <Input
            id="mail-from"
            value={form.fromName}
            onChange={(e) => setForm({ ...form, fromName: e.target.value })}
            placeholder="Capstone Contest"
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mail-pass">Password</Label>
          <div className="relative">
            <Input
              id="mail-pass"
              type={showPass ? "text" : "password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={view.hasPassword ? "•••••••• (saved - leave empty to keep)" : "App password"}
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            For Gmail, use a 16-character App Password (Google Account → Security → App passwords),
            not your normal password. It is stored encrypted and never shown again.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {view.source === "panel" ? (
          <Button variant="ghost" className="mr-auto gap-1.5 rounded-xl text-muted-foreground" disabled={busy !== null} onClick={reset}>
            {busy === "reset" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
            Use .env instead
          </Button>
        ) : null}
        <Button
          variant="outline"
          className="gap-1.5 rounded-xl"
          disabled={busy !== null || dirty || view.source === "none"}
          title={dirty ? "Save first" : undefined}
          onClick={test}
        >
          {busy === "test" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          Send test email
        </Button>
        <Button className="gap-1.5 rounded-xl font-semibold" disabled={busy !== null || !dirty} onClick={save}>
          {busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Save email settings
        </Button>
      </div>
    </section>
  );
}
