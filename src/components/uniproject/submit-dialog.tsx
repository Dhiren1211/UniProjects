"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, SEMESTERS, YEARS } from "@/lib/config";
import { cn } from "@/lib/utils";
import { fetchDepartments, submitProject, type DepartmentDTO, type Navigate } from "./api";

const ROLES = [
  "Team Lead",
  "Frontend",
  "Backend",
  "Designer",
  "Hardware",
  "Firmware",
  "Researcher",
  "Member",
];

type MemberRow = { name: string; role: string };

const EMPTY_FORM = {
  title: "",
  summary: "",
  description: "",
  dept: "",
  category: "",
  year: String(new Date().getFullYear()),
  semester: "Spring",
  supervisor: "",
  tags: "",
  demoUrl: "",
  repoUrl: "",
};

export function SubmitDialog({
  open,
  onOpenChange,
  navigate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  navigate: Navigate;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [members, setMembers] = useState<MemberRow[]>([{ name: "", role: "Team Lead" }]);
  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Load departments each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    fetchDepartments(ac.signal)
      .then(setDepartments)
      .catch(() => {});
    return () => ac.abort();
  }, [open]);

  const set = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 4) e.title = "Title must be at least 4 characters";
    if (form.summary.trim().length < 20)
      e.summary = "Summary must be at least 20 characters";
    if (form.description.trim().length < 60)
      e.description = "Description must be at least 60 characters";
    if (!form.dept) e.dept = "Pick a department";
    if (!form.category) e.category = "Pick a category";
    if (members.filter((m) => m.name.trim()).length === 0)
      e.members = "Add at least one team member";
    for (const [key, label] of [
      ["demoUrl", "Demo link"],
      ["repoUrl", "Repository link"],
    ] as const) {
      const v = form[key].trim();
      if (v && !/^https?:\/\/.+/.test(v)) e[key] = `${label} must start with http(s)://`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSaving(true);
    try {
      const created = await submitProject({
        title: form.title.trim(),
        summary: form.summary.trim(),
        description: form.description.trim(),
        category: form.category,
        year: Number(form.year),
        semester: form.semester,
        dept: form.dept,
        supervisor: form.supervisor.trim() || undefined,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 8),
        demoUrl: form.demoUrl.trim() || undefined,
        repoUrl: form.repoUrl.trim() || undefined,
        members: members
          .filter((m) => m.name.trim())
          .map((m) => ({ name: m.name.trim(), role: m.role })),
      });
      toast.success("Project submitted to the showcase");
      setForm(EMPTY_FORM);
      setMembers([{ name: "", role: "Team Lead" }]);
      onOpenChange(false);
      navigate({ name: "project", slug: created.slug });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit project");
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="mt-1 text-xs font-medium text-danger">{errors[key]}</p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto nice-scroll sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Submit a project
          </DialogTitle>
          <DialogDescription>
            Showcase your work on the {""}
            <span className="font-medium text-foreground">UniProjects</span> gallery. It
            will appear on the site immediately after submission.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Basics */}
          <div className="space-y-1.5">
            <Label htmlFor="sp-title">Project title</Label>
            <Input
              id="sp-title"
              placeholder="e.g. CampusNav AR"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={cn(errors.title && "border-destructive")}
            />
            {fieldError("title")}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-summary">One-sentence summary</Label>
            <Input
              id="sp-summary"
              placeholder="What does it do, in one clear sentence?"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              className={cn(errors.summary && "border-destructive")}
            />
            {fieldError("summary")}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-desc">About the project</Label>
            <Textarea
              id="sp-desc"
              rows={6}
              placeholder="Describe the problem, your approach, and the result. Separate paragraphs with a blank line."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={cn(errors.description && "border-destructive")}
            />
            {fieldError("description")}
          </div>

          {/* Academics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select
                value={form.dept}
                onValueChange={(v) => set("dept", v)}
              >
                <SelectTrigger
                  aria-label="Department"
                  className={cn("w-full", errors.dept && "border-destructive")}
                >
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.code}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("dept")}
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger
                  aria-label="Category"
                  className={cn("w-full", errors.category && "border-destructive")}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("category")}
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select value={form.year} onValueChange={(v) => set("year", v)}>
                <SelectTrigger aria-label="Year" className="w-full">
                  <SelectValue />
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
            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Select value={form.semester} onValueChange={(v) => set("semester", v)}>
                <SelectTrigger aria-label="Semester" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-super">Supervisor</Label>
            <Input
              id="sp-super"
              placeholder="e.g. Prof. Dana Kim (optional)"
              value={form.supervisor}
              onChange={(e) => set("supervisor", e.target.value)}
            />
          </div>

          {/* Links & tags */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sp-demo">Demo link</Label>
              <Input
                id="sp-demo"
                placeholder="https://… (optional)"
                value={form.demoUrl}
                onChange={(e) => set("demoUrl", e.target.value)}
                className={cn(errors.demoUrl && "border-destructive")}
              />
              {fieldError("demoUrl")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-repo">Repository link</Label>
              <Input
                id="sp-repo"
                placeholder="https://github.com/… (optional)"
                value={form.repoUrl}
                onChange={(e) => set("repoUrl", e.target.value)}
                className={cn(errors.repoUrl && "border-destructive")}
              />
              {fieldError("repoUrl")}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-tags">Tags</Label>
            <Input
              id="sp-tags"
              placeholder="comma separated, e.g. react, iot, dashboard"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
            />
          </div>

          <Separator />

          {/* Team members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Team members</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg"
                onClick={() =>
                  setMembers((m) => [...m, { name: "", role: "Member" }])
                }
              >
                <Plus className="size-3.5" aria-hidden />
                Add member
              </Button>
            </div>
            {errors.members ? (
              <p className="text-xs font-medium text-danger">{errors.members}</p>
            ) : null}
            <div className="space-y-2">
              {members.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    aria-label={`Member ${i + 1} name`}
                    placeholder="Full name"
                    value={m.name}
                    onChange={(e) =>
                      setMembers((arr) =>
                        arr.map((row, ri) =>
                          ri === i ? { ...row, name: e.target.value } : row
                        )
                      )
                    }
                    className="flex-1"
                  />
                  <Select
                    value={m.role}
                    onValueChange={(v) =>
                      setMembers((arr) =>
                        arr.map((row, ri) => (ri === i ? { ...row, role: v } : row))
                      )
                    }
                  >
                    <SelectTrigger aria-label={`Member ${i + 1} role`} className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove member ${i + 1}`}
                    disabled={members.length === 1}
                    onClick={() => setMembers((arr) => arr.filter((_, ri) => ri !== i))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-32 font-semibold">
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              "Submit project"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
