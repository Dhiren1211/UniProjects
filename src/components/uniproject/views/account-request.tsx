"use client";

// ============================================================
// AccountRequest - the public intake form (no public signup).
// The coordinator approves requests in the admin panel;
// credentials are emailed to a<studentId>@ks.ac.kr.
// ============================================================

import { useEffect, useState } from "react";
import { CheckCircle2, GraduationCap, IdCard, Loader2, Lock, Presentation, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchProfessorsPublic,
  submitAccountRequest,
  type AccountRequestDTO,
  type Navigate,
} from "../api-client";
import { useAppStore } from "../store";
import { cn } from "@/lib/utils";


const YEARS = [2023, 2024, 2025, 2026];

const STUDENT_ID_RE = /^\d{6,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RequestRole = "STUDENT" | "PROFESSOR";

const ROLE_OPTIONS: { value: RequestRole; label: string; hint: string; icon: typeof GraduationCap }[] = [
  { value: "STUDENT", label: "Student", hint: "I'm taking a capstone course", icon: GraduationCap },
  { value: "PROFESSOR", label: "Professor", hint: "I teach or supervise capstone", icon: Presentation },
];

export function AccountRequestView({ navigate }: { navigate: Navigate }) {
  const settings = useAppStore((s) => s.settings);
  const user = useAppStore((s) => s.user);
  const [role, setRole] = useState<RequestRole>("STUDENT");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [capstone, setCapstone] = useState<"I" | "II" | "III" | "">("");
  const [year, setYear] = useState("");
  const [professor, setProfessor] = useState("");
  // Professor picker options - the registered professor accounts, loaded from
  // the public endpoint (the field stays free-text if none are registered).
  const [professorOptions, setProfessorOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    role: RequestRole;
    request: AccountRequestDTO;
    universityEmail: string;
    message: string;
  } | null>(null);

  const closed = settings?.accountRequestsOpen === false;
  const idOk = STUDENT_ID_RE.test(studentId.trim());
  const emailOk = EMAIL_RE.test(email.trim());
  const isStudent = role === "STUDENT";

  // Registered professors feed the picker - students who pick one inherit
  // that professor's class ID.
  useEffect(() => {
    const ac = new AbortController();
    fetchProfessorsPublic(ac.signal)
      .then((rows) => {
        if (ac.signal.aborted) return;
        const names = [
          ...new Set(
            rows
              .map((p) => p.displayName.trim())
              .filter((n) => n.length > 0)
          ),
        ];
        if (names.length > 0) setProfessorOptions(names);
      })
      .catch(() => {}); // network/HTTP failure → free-text entry only
    return () => ac.abort();
  }, []);

  // live display-only hint - mirrors the server's derivation
  const emailHint = `a${studentId.trim() || "········"}@ks.ac.kr`;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    if (name.trim().length < 2) {
      setError("Enter your full name");
      return;
    }
    if (!isStudent) {
      if (!emailOk) {
        setError("Enter your university email address");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await submitAccountRequest({
          role: "PROFESSOR",
          email: email.trim().toLowerCase(),
          name: name.trim(),
        });
        setSuccess({ ...res, role: "PROFESSOR" });
        toast.success(res.message || "Request submitted");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not submit the request";
        setError(msg);
        toast.error(msg);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!idOk) {
      setError("Enter your 6–10 digit student number");
      return;
    }
    if (!capstone) {
      setError("Choose your capstone round");
      return;
    }
    if (!year) {
      setError("Choose the course year");
      return;
    }
    if (!professor.trim()) {
      setError("Enter your professor's name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await submitAccountRequest({
        role: "STUDENT",
        studentId: studentId.trim(),
        name: name.trim(),
        capstone: capstone as "I" | "II" | "III",
        year: Number(year),
        professor: professor.trim(),
      });
      setSuccess({ ...res, role: "STUDENT" });
      toast.success(res.message || "Request submitted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not submit the request";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-5 py-10 pb-20 md:py-14">
      {user ? (
        <SignedInNotice
          name={user.displayName}
          role={user.role}
          isAdmin={user.role === "ADMIN" || user.role === "MODERATOR"}
          navigate={navigate}
        />
      ) : closed ? (
        <ClosedNotice />
      ) : success ? (
        <SuccessCard
          role={success.role}
          message={success.message}
          universityEmail={success.universityEmail}
          name={success.request.name}
        />
      ) : (
        <>
          {/* header */}
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <IdCard className="size-5" aria-hidden />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Request an account
            </h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Accounts are provisioned by the capstone coordinator - there is no public signup.
            Tell us whether you&apos;re a student or a professor.
          </p>

          {/* form */}
          <form
            onSubmit={submit}
            className="mt-6 rounded-2xl border border-up-border bg-card p-5 shadow-card md:p-6"
            noValidate
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label id="ar-role-label">I am a</Label>
                <div
                  role="radiogroup"
                  aria-labelledby="ar-role-label"
                  className="grid grid-cols-2 gap-2"
                >
                  {ROLE_OPTIONS.map((opt) => {
                    const active = role === opt.value;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setRole(opt.value);
                          setError(null);
                        }}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-primary-500 bg-primary-50"
                            : "border-up-border bg-card hover:border-up-border-strong"
                        )}
                      >
                        <Icon
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            active ? "text-primary-700" : "text-muted-foreground"
                          )}
                          aria-hidden
                        />
                        <span>
                          <span
                            className={cn(
                              "block text-sm font-semibold",
                              active ? "text-primary-700" : "text-foreground"
                            )}
                          >
                            {opt.label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                            {opt.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {isStudent ? (
              <div className="space-y-1.5">
                <Label htmlFor="ar-student-id">Student ID</Label>
                <Input
                  id="ar-student-id"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value.replace(/\D/g, "").slice(0, 10));
                    if (error) setError(null);
                  }}
                  inputMode="numeric"
                  pattern="\d{6,10}"
                  placeholder="e.g. 20233456"
                  autoComplete="off"
                  aria-invalid={studentId.length > 0 && !idOk}
                />
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  Credentials will be emailed to{" "}
                  <span className="font-mono font-medium text-foreground">{emailHint}</span>
                </p>
              </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="ar-name">Full name</Label>
                <Input
                  id="ar-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  maxLength={80}
                />
              </div>

              {!isStudent ? (
                <div className="space-y-1.5">
                  <Label htmlFor="ar-email">University email</Label>
                  <Input
                    id="ar-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="name@ks.ac.kr"
                    autoComplete="email"
                    maxLength={200}
                    aria-invalid={email.length > 0 && !emailOk}
                  />
                  <p className="text-xs text-muted-foreground">
                    No student ID needed. Your credentials will be emailed here, and your
                    username will be the part before the @.
                  </p>
                </div>
              ) : null}

              {isStudent ? (
              <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ar-capstone">Capstone Design</Label>
                  <Select
                    value={capstone}
                    onValueChange={(v) => {
                      setCapstone(v as "I" | "II" | "III");
                      if (error) setError(null);
                    }}
                  >
                    <SelectTrigger id="ar-capstone" aria-label="Capstone round" className="w-full">
                      <SelectValue placeholder="Choose round" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="I">Capstone I</SelectItem>
                      <SelectItem value="II">Capstone II</SelectItem>
                      <SelectItem value="III">Capstone III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ar-year">Year</Label>
                  <Select
                    value={year}
                    onValueChange={(v) => {
                      setYear(v);
                      if (error) setError(null);
                    }}
                  >
                    <SelectTrigger id="ar-year" aria-label="Course year" className="w-full">
                      <SelectValue placeholder="Choose year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ar-professor">Professor</Label>
                <Input
                  id="ar-professor"
                  value={professor}
                  onChange={(e) => {
                    setProfessor(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. Prof. Kim"
                  list="ar-professor-list"
                  maxLength={80}
                  autoComplete="off"
                />
                <datalist id="ar-professor-list">
                  {professorOptions.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Your capstone section - pick one of the registered professors or type the
                  name.
                </p>
              </div>
              </>
              ) : null}

              {error ? (
                <p className="text-xs font-medium text-danger" role="alert">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={busy}
                className="h-11 w-full rounded-xl font-semibold"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Submit request"}
              </Button>

              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Already approved? Sign in with your{" "}
                {isStudent ? "student ID" : "username"} and the password emailed to you.
              </p>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

/** Success state - the coordinator now takes over. */
function SuccessCard({
  role,
  message,
  universityEmail,
  name,
}: {
  role: RequestRole;
  message: string;
  universityEmail: string;
  name: string;
}) {
  return (
    <div className="rounded-2xl border border-up-border bg-card p-6 text-center shadow-card md:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground md:text-2xl">
        Request received{typeof name === "string" && name ? `, ${name.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
      <p className="mx-auto mt-4 w-fit rounded-xl bg-surface-muted px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">
          {role === "PROFESSOR" ? "Email: " : "University email: "}
        </span>
        <span className="font-mono font-semibold text-foreground">{universityEmail}</span>
      </p>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Please wait for the coordinator to approve your request - your password will arrive at
        that address. Sign in with your {role === "PROFESSOR" ? "username" : "student ID"} once it
        does.
      </p>
    </div>
  );
}

/** The office closed the intake - show the notice instead of the form. */
function ClosedNotice() {
  return (
    <div className="rounded-2xl border border-up-border bg-card p-6 text-center shadow-card md:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
        <Lock className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground md:text-2xl">
        Account requests are closed
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        The capstone office isn&apos;t accepting new account requests right now. If you believe
        this is a mistake, contact your professor or the coordinator directly.
      </p>
    </div>
  );
}

/**
 * Signed-in members don't need an account - the request entry points are hidden
 * everywhere once logged in, and deep links land on this friendly notice.
 */
function SignedInNotice({
  name,
  role,
  isAdmin,
  navigate,
}: {
  name: string;
  role: string;
  isAdmin: boolean;
  navigate: Navigate;
}) {
  const roleLine = isAdmin
    ? "You're signed in as staff - account requests arrive in the admin panel's Approvals tab."
    : role === "PROFESSOR"
      ? "You're signed in as faculty - your students request accounts through this form, and the coordinator emails their credentials."
      : "You're signed in - your account is already active, so there's nothing to request.";

  return (
    <div className="rounded-2xl border border-up-border bg-card p-6 text-center shadow-card md:p-8">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <UserCheck className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground md:text-2xl">
        You&apos;re already signed in
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {roleLine}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">Welcome, {name}.</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => navigate({ name: "dashboard" })}
          className="h-10 rounded-xl px-5 font-semibold"
        >
          Go to my dashboard
        </Button>
        <Button
          onClick={() => navigate({ name: "projects" })}
          variant="outline"
          className="h-10 rounded-xl px-5 font-semibold"
        >
          Browse projects
        </Button>
      </div>
    </div>
  );
}
