import type { MemberDTO, ProjectDetail, ProjectListItem, StatsDTO, DepartmentDTO } from "@/lib/types";

export type { MemberDTO, ProjectDetail, ProjectListItem, StatsDTO, DepartmentDTO };

export type View =
  | { name: "home" }
  | { name: "projects"; q?: string; dept?: string; category?: string; year?: number }
  | { name: "project"; slug: string };

export type Navigate = (v: View) => void;

// ---------- fetch helpers (plain promises, abort-aware) ----------

export async function fetchStats(signal?: AbortSignal): Promise<StatsDTO> {
  const res = await fetch("/api/stats", { signal });
  if (!res.ok) throw new Error("Failed to load stats");
  const data = await res.json();
  return data.stats as StatsDTO;
}

export async function fetchDepartments(signal?: AbortSignal): Promise<DepartmentDTO[]> {
  const res = await fetch("/api/departments", { signal });
  if (!res.ok) throw new Error("Failed to load departments");
  const data = await res.json();
  return data.departments as DepartmentDTO[];
}

export async function fetchProjects(
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal
): Promise<ProjectListItem[]> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const res = await fetch(`/api/projects?${sp.toString()}`, { signal });
  if (!res.ok) throw new Error("Failed to load projects");
  const data = await res.json();
  return data.projects as ProjectListItem[];
}

export async function fetchProject(slug: string, signal?: AbortSignal): Promise<ProjectDetail> {
  const res = await fetch(`/api/projects/${slug}`, { signal });
  if (!res.ok) throw new Error(res.status === 404 ? "Project not found" : "Failed to load project");
  const data = await res.json();
  return data.project as ProjectDetail;
}

export type SubmitPayload = {
  title: string;
  summary: string;
  description: string;
  category: string;
  year: number;
  semester: string;
  dept: string;
  supervisor?: string;
  tags?: string[];
  demoUrl?: string;
  repoUrl?: string;
  members: { name: string; role: string }[];
};

export async function submitProject(payload: SubmitPayload): Promise<ProjectListItem> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Failed to submit project");
  return data.project as ProjectListItem;
}
