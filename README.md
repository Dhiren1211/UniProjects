# Capstone Contest - Kyungsung University capstone projects

A minimal, role-based capstone project showcase for a single university. Students are
provisioned by the capstone coordinator (no public signup), team leaders submit projects,
professors verify work in their own sections, and staff manage the platform through a
simple admin console.

Stack: **Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma (SQLite) · Bun**

---

## Getting started

```bash
bun install
bun run db:push        # push the Prisma schema to the Postgres DATABASE_URL
bun prisma/seed.ts     # WIPES all data, then creates departments, technologies, settings + one admin
bun run dev            # http://localhost:3001
```

Other scripts: `bun run lint`, `bun run db:generate`, `bun run db:reset`.

## First admin

The seed creates a single `ADMIN` account and nothing else - no demo users or projects.
Configure it with `ADMIN_USERNAME`, `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in
`.env`. If `ADMIN_PASSWORD` is not set, a strong random password is generated and printed
once. Everyone else is provisioned through account requests in the admin console.

Students log in with their **student number** (the userID) or their university email
(`a<studentNumber>@ks.ac.kr`).

## Feature map

- **Intake**: public *Request an account* form (Student ID, name, capstone I–III, year,
  professor - **no email field**; the address `a<studentNumber>@ks.ac.kr` is derived).
  Admin approves → backend generates userID + temporary password, provisions the
  account with its `classID` section, and files a credentials email in the outbox
  (`EmailLog`, surfaced in **Admin → Emails**; swap `src/lib/mailer.ts` for SMTP in
  production).
- **Roles**: `ADMIN > MODERATOR > PROFESSOR > STUDENT` (+ unauthenticated VISITOR) -
  see `src/lib/rbac.ts`. Navigation, dashboard, admin tabs and every API gate respect it.
- **Submissions**: only team leaders (or staff) can submit - enforced in the UI *and*
  by `POST /api/projects` returning 403 for members.
- **Sections**: students sharing a `classID` (e.g. `CD2-2026-KIM`) form one section
  under one professor; the admin overview groups projects/students per section and
  professors may only verify inside their own sections.
- **Professor class sections**: every registered professor can carry a **teaching
  section `classID`** (Admin → Users → Edit member → *Teaching section*, or the
  New-member dialog when creating a professor). Students who name that professor -
  on the public request form or in the admin New-member dialog - are enrolled into
  the professor's `classID`, so **all students of the same professor share one
  class ID** regardless of capstone round/year. Resolution order: admin override →
  the registered professor's classID → deterministic `CD{round}-{year}-{SURNAME}`
  fallback. The public request form's Professor picker lists every registered
  professor account (static fallback list when the directory is unreachable).
- **Site settings** (Admin → Settings): global search-bar toggle (header, ⌘K palette
  and the projects page), account-request intake switch, site name, hero copy and
  hero image - stored in the `Setting` table, applied site-wide on save.
- **Departments**: the official Kyungsung catalogue (62 학부/학과, from
  kscms.ks.ac.kr) ships via `prisma/ks-departments.ts`. Each department carries an
  optional **university website link** (admin-editable in Admin → Departments;
  rendered as a redirect button on project pages and the admin cards) and a
  **capstone term** (`capstoneLabel`, default "Capstone Design" - Global IT's
  terminology; other faculties can rename it to e.g. "Graduation Work", which then
  drives the admin intake form and student dashboards).
- **Professor profiles**: project supervisors resolve to professor accounts - the
  detail page links to the faculty profile, which also lists the projects they
  supervise. Professors can add their **university profile link** (Account
  settings → *University profile*, or Admin → Users → 🎓 button); it shows as a
  redirect button on their public profile.
- **Intake visibility**: every "Request an account" entry point (header drawer,
  footer, home hero + steps, guidelines CTA) is guest-only. Signed-in visitors who
  deep-link to the request form see a friendly "You're already signed in" notice.
- **Forgot password**: the sign-in dialog has a *Forgot password?* flow - the
  visitor enters their university email; if it belongs to a registered account a
  fresh temporary password is generated, stored, and emailed
  (`PASSWORD_RESET` outbox mail). The response is neutral either way (no account
  enumeration) and **every attempt is registered in Admin → Resets** with the
  matched account (or a *No match* flag). Students keep signing in with their
  student number, staff with their username.
- **Admin user editing**: Admin → Users → Edit member (👤 button) edits name,
  username, email, role, department, program, the student section (Student ID,
  classID, capstone, cohort year, professor, team role) and the professor teaching
  section + university profile link, plus an optional password reset (blank keeps
  the current password). Uniqueness conflicts return friendly 409s; moving a
  member off STUDENT strips section data automatically.

## Testing each flow

1. **Visitor** → About/Projects/Announcements/Guidelines work; no Submit button;
   auth modal is login-only with a "request an account" link.
2. **Request an account** → submit the public form; duplicate student IDs get 409.
3. **Admin approvals** → Admin → Approvals → Review a pending request → the classID
   is prefilled from the named professor's registered teaching section (falls back
   to `CD{round}-{year}-{SURNAME}`), choose Member/Team Leader → Approve →
   credentials popup with copy buttons → the email appears in Admin → Emails.
4. **Student login** → sign in with the generated userID + password; change the
   password in Account settings.
5. **Professor class section** → Admin → Users → Edit a professor → set the
   *Teaching section* classID → submit a public request naming that professor →
   approve with the prefilled classID → the student's classID equals the
   professor's. Two students naming the same professor always land in one section.
6. **Forgot password** → sign out → Sign in → *Forgot password?* → enter a
   registered university email (e.g. `a<studentNumber>@ks.ac.kr`) → neutral success notice →
   Admin → Resets shows the request with the matched account, and Admin → Emails →
   *Password resets* shows the mail. The old password stops working; the emailed
   temporary password signs in.
7. **Admin edit member** → Admin → Users → 👤 Edit → change name/username/email or
   reset a password (blank = keep) → save; duplicate username/email/student ID get
   clear 409 toasts.
8. **Leader vs member** → leader sees Submit and can publish; a member sees no submit
   UI and gets 403 from the API.
9. **Search toggle** → Admin → Settings → turn *Search bar* off → save → the header
   icon, ⌘K palette and projects-page search disappear; re-enable to restore.
10. **Moderator / professor** → sign in as a moderator (limited console) and
    a professor (section verification queue); each dashboard reflects its role.
11. **Departments** → Admin → Departments: edit a department's *University website*
    link or *Capstone term* → the project-page redirect button and the intake-form
    labels update. New-member dialog: pick a department → the capstone round options
    rename to that faculty's term.
12. **Professor link** → sign in as a professor → Account settings → *University
    profile* → paste the faculty page URL → save; it appears on the public profile
    and in Admin → Users. Admins can also set it from the console (🎓 button).
13. **Intake hiding** → sign in, then check the header drawer, footer, home and
    guidelines: no "Request an account" anywhere; opening the request form signed-in
    shows the "already signed in" notice.

## Removed in this overhaul

Public signup, the email-verification code flow, Google demo auth, the community
board, the student directory and campus events were removed to keep the platform
focused (requirement 7). Project likes/bookmarks, join requests, comments,
verifications, notifications and profiles remain.

## Project layout

```
prisma/schema.prisma          # models + role/section fields
src/lib/rbac.ts               # role hierarchy + capability helpers
src/lib/settings.ts           # DB-backed site settings
src/lib/mailer.ts             # credential/system email + outbox
src/app/api/                  # REST API (auth, account-requests, settings,
                              # announcements, projects, admin, upload, …)
src/components/uniproject/    # SPA shell, header/footer, views (home, projects,
                              # dashboard, admin, announcements, guidelines, …)
```
