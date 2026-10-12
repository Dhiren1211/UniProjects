"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ImagePlus,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { AVATAR_PRESETS } from "@/lib/config";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchDepartments,
  updateProfile,
  uploadFile,
  type DepartmentDTO,
  type Navigate,
  type SafeUserDTO,
} from "../api-client";
import { useAppStore } from "../store";
import { EmptyState, UserAvatar } from "../ui-bits";

export function SettingsView({ navigate: _navigate }: { navigate: Navigate }) {
  const { user, authLoaded, openAuth } = useAppStore();

  if (!authLoaded) {
    return (
      <Page>
        <div className="rounded-2xl border border-up-border bg-card p-6 md:p-8">
          <div className="space-y-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </Page>
    );
  }

  if (!user) {
    return (
      <Page>
        <EmptyState
          icon={Lock}
          title="Sign in to manage your profile"
          hint="Your name, bio, skills, and password settings live here."
          action={
            <Button onClick={() => openAuth("login")} className="rounded-xl font-semibold">
              Sign in
            </Button>
          }
        />
      </Page>
    );
  }

  return <SettingsForm key={user.id} user={user} />;
}

function SettingsForm({ user }: { user: SafeUserDTO }) {
  const { setUser } = useAppStore();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarInput, setAvatarInput] = useState(user.avatarUrl ?? "");
  const [program, setProgram] = useState(user.program ?? "");
  const [skills, setSkills] = useState(user.skills.join(", "));
  const [website, setWebsite] = useState(user.website ?? "");
  const [github, setGithub] = useState(user.github ?? "");
  const [dept, setDept] = useState(user.department?.code ?? "");
  const [teammates, setTeammates] = useState(user.lookingForTeammates);

  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const pwMismatch = newPassword.length > 0 && confirmPassword.length > 0 && confirmPassword !== newPassword;

  // avatar picker: preset gallery + custom upload + advanced paste-a-link
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [linkOpen, setLinkOpen] = useState(
    Boolean(user.avatarUrl) && !AVATAR_PRESETS.includes(user.avatarUrl ?? "")
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchDepartments(ac.signal)
      .then(setDepartments)
      .catch(() => {});
    return () => ac.abort();
  }, []);

  // make sure the user's current department is selectable even if the directory fails
  const deptOptions = [...departments];
  if (user.department && !deptOptions.some((d) => d.code === user.department?.code)) {
    deptOptions.unshift({
      id: user.department.id,
      name: user.department.name,
      code: user.department.code,
      tagline: null,
      accent: user.department.accent,
    });
  }

  const handleSave = async () => {
    if (saving) return;
    if (displayName.trim().length < 1) {
      toast.error("Your name can't be empty");
      return;
    }
    const avatar = avatarInput.trim();
    if (avatar && !avatar.startsWith("/") && !avatar.startsWith("https://")) {
      toast.error("Avatar link must start with / or https://");
      return;
    }
    const pw = newPassword;
    if (pw) {
      if (!currentPassword) {
        toast.error("Enter your current password to change it");
        return;
      }
      if (pw.length < 8) {
        toast.error("New password must be at least 8 characters");
        return;
      }
      if (confirmPassword !== pw) {
        toast.error("New passwords don't match — check both fields");
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Partial<SafeUserDTO> & {
        currentPassword?: string;
        newPassword?: string;
        avatarUrl?: string | null;
      } = {
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        avatarUrl: avatar || null,
        program: program.trim() || null,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        website: website.trim() || null,
        github: github.trim() || null,
        lookingForTeammates: teammates,
      };
      // only send the department when the directory loaded, so we never accidentally clear it
      if (departments.length > 0) {
        payload.department = departments.find((d) => d.code === dept) ?? null;
      }
      if (pw) {
        payload.currentPassword = currentPassword;
        payload.newPassword = pw;
      }

      const updated = await updateProfile(payload);
      setUser(updated);
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file || uploading) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That file isn't an image — choose a JPG, PNG, WebP, or GIF.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Photo is too large — the limit is 6 MB.");
      return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const url = await uploadFile(file, "avatar", setUploadPct);
      setAvatarInput(url);
      toast.success("Photo uploaded — press Save changes to keep it.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed — try again");
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  return (
    <Page>
      {/* Heading */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          How you appear across the campus showcase.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-up-border bg-card p-6 shadow-card md:p-8">
        {/* ---------- Profile ---------- */}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Profile
        </h2>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            {/* Live preview: matches the profile hero treatment (size-20, rounded-2xl) */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <UserAvatar
                  name={displayName.trim() || user.displayName}
                  avatarUrl={avatarInput.trim() || null}
                  ring={false}
                  className="size-20 shrink-0 rounded-2xl text-2xl"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {displayName.trim() || user.displayName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {avatarInput.trim()
                      ? "Looking good — save changes to apply it."
                      : "Using your initials — pick a look below."}
                  </p>
                </div>
              </div>
              {avatarInput.trim() ? (
                <Button
                  variant="ghost"
                  onClick={() => setAvatarInput("")}
                  disabled={uploading}
                  className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold text-muted-foreground hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Remove photo
                </Button>
              ) : null}
            </div>

            {/* Preset gallery + custom upload tile (last cell — same size, so no layout jump) */}
            <div
              role="group"
              aria-label="Avatar gallery"
              className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3"
            >
              {AVATAR_PRESETS.map((path, i) => {
                const selected = avatarInput.trim() === path;
                return (
                  <motion.button
                    key={path}
                    type="button"
                    aria-label={"Use avatar " + (i + 1)}
                    aria-pressed={selected}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setAvatarInput(path)}
                    className={`relative aspect-square overflow-hidden rounded-xl border bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                      selected
                        ? "border-transparent ring-2 ring-primary-500"
                        : "border-up-border hover:border-foreground/30"
                    }`}
                  >
                    <img src={path} alt="" loading="lazy" className="size-full object-cover" />
                    {selected ? (
                      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary-500 text-white shadow-sm">
                        <Check className="size-3" aria-hidden />
                      </span>
                    ) : null}
                  </motion.button>
                );
              })}

              <button
                type="button"
                aria-label="Upload a custom avatar photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-dashed border-up-border bg-surface-muted/50 text-muted-foreground transition-colors hover:border-primary-500/60 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-70"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="size-4" aria-hidden />
                )}
                <span className="px-1 text-center text-[11px] font-medium leading-tight">
                  {uploading ? `Uploading ${uploadPct}%` : "Upload your own"}
                </span>
                {uploading ? (
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-white/70">
                    <span
                      className="block h-full bg-primary-500 transition-[width] duration-200"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </span>
                ) : null}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void handleAvatarFile(file);
              }}
            />

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Pick a campus avatar or upload your own photo — it shows next to your name, posts, and
              comments. JPG, PNG, WebP, or GIF up to 6 MB.
            </p>

            {/* Advanced: paste an image link instead */}
            <Collapsible open={linkOpen} onOpenChange={setLinkOpen} className="mt-1">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="-ml-2 h-8 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Link2 className="size-3.5" aria-hidden />
                  Paste an image link instead
                  <ChevronDown
                    className={`size-3.5 transition-transform ${linkOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1.5 pb-1 pt-1.5">
                  <Label htmlFor="st-avatar">Or paste an image link</Label>
                  <Input
                    id="st-avatar"
                    value={avatarInput}
                    onChange={(e) => setAvatarInput(e.target.value)}
                    placeholder="https://… or /avatars/av1.webp"
                    type="text"
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must start with https:// or / — leave empty to use your initials.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="st-name">Full name</Label>
            <Input
              id="st-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="st-bio">Bio</Label>
            <Textarea
              id="st-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A line or two about you and what you like to build…"
              className="resize-none rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="st-program">Program</Label>
            <Input
              id="st-program"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="e.g. B.S. Computer Science"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="st-skills">Skills</Label>
            <Input
              id="st-skills"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Comma separated — e.g. React, Python, Figma"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="st-website">Website</Label>
            <Input
              id="st-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://your-site.dev"
              type="url"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="st-github">GitHub</Label>
            <Input
              id="st-github"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="https://github.com/you"
              type="url"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="st-dept">Department</Label>
            <Select
              value={dept || "__none__"}
              onValueChange={(v) => setDept(v === "__none__" ? "" : v)}
            >
              <SelectTrigger id="st-dept" aria-label="Department" className="w-full rounded-xl">
                <SelectValue placeholder="Choose a department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No department</SelectItem>
                {deptOptions.map((d) => (
                  <SelectItem key={d.id} value={d.code}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-up-border bg-white px-4 py-3 md:col-span-2">
            <div>
              <Label htmlFor="st-teammates" className="cursor-pointer">
                Open to teamwork
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Show a badge on your profile so project teams can find you.
              </p>
            </div>
            <Switch
              id="st-teammates"
              checked={teammates}
              onCheckedChange={setTeammates}
              aria-label="Open to teamwork"
            />
          </div>
        </div>

        {/* ---------- Security ---------- */}
        <div className="mt-8 border-t border-up-border pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Security
          </h2>

          <Collapsible open={pwOpen} onOpenChange={setPwOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="-ml-2 h-9 rounded-xl font-semibold">
                <KeyRound className="size-4" aria-hidden />
                Change password
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${pwOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 grid gap-5 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="st-pw-current">Current password</Label>
                  <Input
                    id="st-pw-current"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-pw-new">New password</Label>
                  <Input
                    id="st-pw-new"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    aria-invalid={pwMismatch}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-pw-confirm">Confirm new password</Label>
                  <Input
                    id="st-pw-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    aria-invalid={pwMismatch}
                    className="rounded-xl"
                  />
                  {confirmPassword.length > 0 && newPassword.length > 0 ? (
                    <p
                      aria-live="polite"
                      className={`text-xs font-medium ${
                        confirmPassword === newPassword ? "text-success" : "text-danger"
                      }`}
                    >
                      {confirmPassword === newPassword
                        ? "✓ Passwords match"
                        : "Passwords don't match yet"}
                    </p>
                  ) : null}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground md:col-span-3">
                  The password only changes when all three fields are filled — otherwise your
                  current password keeps working.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* ---------- Save ---------- */}
        <div className="mt-8 flex items-center justify-end border-t border-up-border pt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-11 rounded-xl px-6 font-semibold"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : "Save changes"}
          </Button>
        </div>
      </section>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 pb-20 md:px-8 md:py-14">{children}</div>
  );
}
