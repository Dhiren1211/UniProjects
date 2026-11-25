"use client";

// ============================================================
// Bulk import students from a CSV or Excel (.xlsx) file.
// 1. download the template  2. pick a file  3. preview & check
// 4. import in batches (25 rows / request)  5. summary + credentials CSV
// Accounts: userID = student number, email a<id>@ks.ac.kr, random password,
// emailed automatically. Existing accounts are skipped, never changed.
// ============================================================

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { importStudents, type ImportRowInput, type ImportResult } from "./api-client";

const BATCH = 25;
const MAX_ROWS = 1000;

// Column aliases (case-insensitive, spaces/underscores ignored).
const COLUMNS: Record<keyof Omit<ImportRowInput, "row">, string[]> = {
  studentId: ["studentid", "student", "id", "studentnumber", "학번"],
  name: ["name", "fullname", "studentname", "이름", "성명"],
  capstone: ["capstone", "round", "capstoneround"],
  year: ["year", "cohort", "cohortyear"],
  professor: ["professor", "prof", "supervisor", "교수"],
  dept: ["dept", "department", "deptcode", "학과"],
  email: ["email", "mail"],
  leader: ["leader", "teamleader", "isleader", "role"],
};

const TEMPLATE =
  "studentId,name,capstone,year,professor,dept,leader\n" +
  "2025123456,Kim Minji,II,2026,Prof. Lee,CSE,yes\n" +
  "2025123457,Park Joon,II,2026,Prof. Lee,CSE,no\n";

function norm(h: string) {
  return h.toLowerCase().replace(/[\s_\-.]/g, "");
}

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toRows(table: unknown[][]): { rows: ImportRowInput[]; missing: string[] } {
  const [header = [], ...body] = table;
  const index: Partial<Record<keyof typeof COLUMNS, number>> = {};
  header.forEach((h, i) => {
    const key = norm(String(h ?? ""));
    for (const [field, aliases] of Object.entries(COLUMNS)) {
      if (aliases.includes(key) && index[field as keyof typeof COLUMNS] === undefined) {
        index[field as keyof typeof COLUMNS] = i;
      }
    }
  });
  const missing = (["studentId", "name"] as const).filter((f) => index[f] === undefined);
  const cell = (r: unknown[], f: keyof typeof COLUMNS) => {
    const i = index[f];
    if (i === undefined) return "";
    const v = r[i];
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(Math.trunc(v)); // Excel stores IDs as numbers
    return String(v).trim();
  };
  const rows = body.map((r, i) => {
    const leader = cell(r, "leader").toLowerCase();
    return {
      row: i + 2, // spreadsheet row number (header is row 1)
      studentId: cell(r, "studentId").replace(/\s/g, ""),
      name: cell(r, "name"),
      capstone: cell(r, "capstone") || undefined,
      year: cell(r, "year") || undefined,
      professor: cell(r, "professor") || undefined,
      dept: cell(r, "dept") || undefined,
      email: cell(r, "email") || undefined,
      leader: ["yes", "y", "true", "1", "leader", "team leader", "o"].includes(leader),
    } satisfies ImportRowInput;
  });
  return { rows, missing };
}

function download(name: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function ImportStudentsDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRowInput[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null); // null = not running
  const [results, setResults] = useState<ImportResult[] | null>(null);

  const reset = () => {
    setFileName("");
    setRows(null);
    setParseError(null);
    setProgress(null);
    setResults(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = (v: boolean) => {
    if (progress !== null) return; // don't close mid-import
    if (!v) reset();
    onOpenChange(v);
  };

  const localIssues = useMemo(() => {
    if (!rows) return [];
    const seen = new Set<string>();
    const out: { row: number; message: string }[] = [];
    for (const r of rows) {
      if (!/^\d{6,10}$/.test(r.studentId)) out.push({ row: r.row, message: "Student ID must be 6–10 digits" });
      else if (seen.has(r.studentId)) out.push({ row: r.row, message: `Duplicate student ID ${r.studentId}` });
      if (r.name.trim().length < 2) out.push({ row: r.row, message: "Name is missing" });
      seen.add(r.studentId);
    }
    return out;
  }, [rows]);

  const onFile = async (file: File) => {
    reset();
    setFileName(file.name);
    try {
      let table: unknown[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/universal");
        table = (await readSheet(file)) as unknown[][];
      } else if (/\.csv$/i.test(file.name) || file.type.includes("csv")) {
        table = parseCsv(await file.text());
      } else {
        setParseError("Use a .csv or .xlsx file (old .xls files: save as .xlsx first).");
        return;
      }
      const { rows: parsed, missing } = toRows(table);
      if (missing.length) {
        setParseError(`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template to see the format.`);
        return;
      }
      if (parsed.length === 0) {
        setParseError("The file has a header but no student rows.");
        return;
      }
      if (parsed.length > MAX_ROWS) {
        setParseError(`Up to ${MAX_ROWS} students per file - split it into smaller files.`);
        return;
      }
      setRows(parsed);
    } catch {
      setParseError("Could not read that file. Check that it is a valid CSV or Excel file.");
    }
  };

  const run = async () => {
    if (!rows) return;
    const badRows = new Set(localIssues.map((i) => i.row));
    const valid = rows.filter((r) => !badRows.has(r.row));
    const all: ImportResult[] = localIssues.map((i) => {
      const r = rows.find((x) => x.row === i.row)!;
      return { row: i.row, studentId: r.studentId, name: r.name, status: "error", message: i.message };
    });
    setProgress(0);
    try {
      for (let i = 0; i < valid.length; i += BATCH) {
        const batch = valid.slice(i, i + BATCH);
        try {
          all.push(...(await importStudents(batch)));
        } catch (e) {
          const message = e instanceof Error ? e.message : "Request failed";
          all.push(...batch.map((r) => ({ row: r.row, studentId: r.studentId, name: r.name, status: "error" as const, message })));
        }
        setProgress(Math.round(((i + batch.length) / Math.max(valid.length, 1)) * 100));
      }
    } finally {
      setProgress(null);
    }
    all.sort((a, b) => a.row - b.row);
    setResults(all);
    if (all.some((r) => r.status === "created")) onImported();
  };

  const created = results?.filter((r) => r.status === "created") ?? [];
  const skipped = results?.filter((r) => r.status === "skipped") ?? [];
  const failed = results?.filter((r) => r.status === "error") ?? [];
  const withPasswords = created.filter((r) => r.password);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary-700" aria-hidden />
            Import students
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Each student gets their student number as user ID,
            a<span className="font-mono">&lt;studentID&gt;</span>@ks.ac.kr as email, and a password sent by email.
            Students who already have an account are skipped.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-success-soft p-3">
                <div className="text-2xl font-bold text-success tabular-nums">{created.length}</div>
                <div className="text-xs text-muted-foreground">created</div>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <div className="text-2xl font-bold text-foreground tabular-nums">{skipped.length}</div>
                <div className="text-xs text-muted-foreground">already existed</div>
              </div>
              <div className="rounded-xl bg-danger-soft p-3">
                <div className="text-2xl font-bold text-danger tabular-nums">{failed.length}</div>
                <div className="text-xs text-muted-foreground">problems</div>
              </div>
            </div>
            {withPasswords.length > 0 ? (
              <div className="rounded-xl border border-warning/40 bg-warning-soft/60 p-3 text-sm">
                <p className="font-semibold text-foreground">
                  {withPasswords.length} password{withPasswords.length > 1 ? "s were" : " was"} not emailed
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Email sending isn't working right now. Download the credentials and give them to the students.
                  This file is only available now.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 gap-1.5 bg-card"
                  onClick={() =>
                    download(
                      "capstone-contest-credentials.csv",
                      "studentId,name,password\n" +
                        withPasswords.map((r) => [r.studentId, r.name, r.password!].map(csvCell).join(",")).join("\n")
                    )
                  }
                >
                  <Download className="size-4" aria-hidden />
                  Download credentials
                </Button>
              </div>
            ) : null}
            {failed.length + skipped.length > 0 ? (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-up-border p-2 text-sm">
                {[...failed, ...skipped].map((r) => (
                  <li key={`${r.row}-${r.studentId}`} className="flex gap-2">
                    <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">row {r.row}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {r.name || r.studentId || "-"}
                      <span className={cn("ml-2", r.status === "error" ? "text-danger" : "text-muted-foreground")}>
                        {r.message}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Import another file
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => download("students-template.csv", TEMPLATE)}>
                <Download className="size-4" aria-hidden />
                Download template
              </Button>
              <span className="text-xs text-muted-foreground">
                Required: studentId, name. Optional: capstone (I/II/III), year, professor, dept, leader (yes/no), email.
              </span>
            </div>

            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-up-border px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary-50/40",
                progress !== null && "pointer-events-none opacity-60"
              )}
            >
              <Upload className="size-6 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium text-foreground">{fileName || "Choose a .csv or .xlsx file"}</span>
              <span className="text-xs text-muted-foreground">Up to {MAX_ROWS} students per file</span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </label>

            {parseError ? (
              <p className="flex items-start gap-2 text-sm text-danger">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {parseError}
              </p>
            ) : null}

            {rows ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                  {rows.length} student{rows.length > 1 ? "s" : ""} found
                  {localIssues.length ? (
                    <span className="text-danger">
                      · {localIssues.length} problem{localIssues.length > 1 ? "s" : ""} (those rows will be skipped)
                    </span>
                  ) : null}
                </p>
                <div className="overflow-x-auto rounded-xl border border-up-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-muted text-muted-foreground">
                      <tr>
                        {["Row", "Student ID", "Name", "Capstone", "Year", "Professor", "Dept", "Leader"].map((h) => (
                          <th key={h} className="whitespace-nowrap px-2.5 py-2 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((r) => (
                        <tr key={r.row} className="border-t border-up-border">
                          <td className="px-2.5 py-1.5 font-mono text-muted-foreground">{r.row}</td>
                          <td className="px-2.5 py-1.5 font-mono">{r.studentId}</td>
                          <td className="px-2.5 py-1.5">{r.name}</td>
                          <td className="px-2.5 py-1.5">{r.capstone ?? ""}</td>
                          <td className="px-2.5 py-1.5">{r.year ?? ""}</td>
                          <td className="px-2.5 py-1.5">{r.professor ?? ""}</td>
                          <td className="px-2.5 py-1.5">{r.dept ?? ""}</td>
                          <td className="px-2.5 py-1.5">{r.leader ? "yes" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 8 ? (
                  <p className="text-xs text-muted-foreground">…and {rows.length - 8} more</p>
                ) : null}
                {localIssues.length ? (
                  <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-danger">
                    {localIssues.slice(0, 20).map((i) => (
                      <li key={`${i.row}-${i.message}`}>
                        Row {i.row}: {i.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {progress !== null ? (
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">Creating accounts and sending emails… {progress}%</p>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)} disabled={progress !== null}>
                Cancel
              </Button>
              <Button
                onClick={run}
                disabled={!rows || progress !== null || rows.length === localIssues.length}
                className="gap-2"
              >
                {progress !== null ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Import {rows ? rows.length - new Set(localIssues.map((i) => i.row)).size : ""} students
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
