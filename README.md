# UniProjects — Kyungsung University Student Project Showcase

> **One campus. Every idea.** — the official platform where Kyungsung University (경성대학교, Busan) students publish capstones, research builds, and prototypes; discover work from every department; and find teammates.

UniProjects is a full-stack, single-university platform: a public showcase for student projects plus a private community layer (projects, teams, events, moderation, and admin) behind sign-in. The university itself is **app-level config** — point `src/lib/config.ts` at another school and the whole system rebrands.

---

## ✨ Features

### Public (no sign-in required)
- **Landing overview** — animated hero with ambient aurora, live platform stats, featured projects, department cards with a signature color-flood hover, event cards with full details and a live countdown, closing CTA.
- **Explore all projects** — search, department / category / year filters, sorting (newest, A–Z, most viewed).
- **Project detail pages** — rich description, tech stack, team, resources (demo / repo / docs), timeline, image gallery, comments, view counts.
- **Student directory & profiles** — portfolios of published work, skills, links, follow counts.

### Community (sign-in required)
- **Projects** — publish or keep drafts, edit full details, allow join requests, mark "looking for teammates"; like 🔥, bookmark, follow, comment.
- **Join requests** — request to join a team with a message; owners approve/reject (automatic notifications).
- **Community board** — campus-wide posts with comments and likes.
- **Notifications** — in-app center for join requests, approvals, comments, follows, likes, and system messages.
- **Settings** — display name, bio, program, skills, links, avatar (curated presets or upload).

### Verification & moderation
- **Email-verified registration** — education emails only (see below).
- **Project verification** — owners request faculty verification; staff review in the moderation queue; approved projects earn a verified badge.
- **Reports** — flag projects or posts for staff review.
- **Admin** — platform overview plus management of departments, events, and users (FACULTY / ADMIN roles).

### Authentication
- Custom session auth: **scrypt** password hashing, httpOnly `up_session` cookie, DB-backed `Session` table (30-day expiry).
- **Email verification flow (required to register):**
  1. The email field validates live — **only education addresses** (`*.edu`, `*.edu.xx`, `*.ac.xx` chains such as `@ks.ac.kr` / `@student.ks.ac.kr`, plus an allowlist) are accepted.
  2. **"Verify email"** sends a **6-digit code** (valid 10 minutes, max 5 attempts, 60-second resend cooldown, codes stored only as SHA-256 hashes).
  3. Entering the code mints a **single-use token** bound to that email — `POST /api/auth/register` requires it, then the account is created with `emailVerified: true`.
- **Google OAuth** route (`/api/auth/google`) — real OAuth when credentials exist, demo sign-in otherwise.
- Sign-in for existing accounts never expires their access (verification gates registration only).

> **📧 Mail delivery:** this sandbox has no SMTP provider, so `src/lib/mailer.ts` writes a formatted email (including the code) to the server console and — outside production — the UI shows a "Demo mode" notice with the code and a **Fill** shortcut. To go live, replace the body of `sendVerificationEmail()` with any provider (SendGrid, SES, Nodemailer…); nothing else changes.

---

## 🛠 Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) + **TypeScript 5** |
| UI | **Tailwind CSS 4**, **shadcn/ui** (New York), Lucide icons, Framer Motion |
| State | Zustand (client) + TanStack Query (server) |
| Database | **Prisma ORM + SQLite** (file `db/custom.db`) |
| Validation | zod (all API payloads) |
| Auth | Custom cookie sessions + scrypt + OAuth route |
| Runtime | Bun |

**Architecture notes**
- One visible route (`/`) — the app is a **hash-based SPA**: `#/explore`, `#/projects/<slug>`, `#/u/<username>`, `#/community`, … switched via a Zustand store, with all data fetched from `/api/**` route handlers (no server actions).
- Shared API contract types live in `src/lib/types.ts`; the typed fetch client is `src/components/uniproject/api-client.ts`.
- Design tokens live in `src/app/globals.css` (teal primary, `--up-night: #062530` dark canvas for hero/CTA/footer).

---

## 🚀 Getting started

```bash
# 1. install
bun install

# 2. environment (.env)
DATABASE_URL=file:./db/custom.db

# 3. create the schema
bun run db:push

# 4. seed departments, 16 projects, 54+ users, events (optional but recommended)
bun prisma/seed.ts

# 5. run
bun run dev        # → http://localhost:3000 (logs tee'd to dev.log)
```

**Demo accounts** (password `demo1234` for all seeded users):
| Username | Role |
|---|---|
| `jisoo.park` | Student |
| `gun.woo` | Faculty (can moderate) |
| `jiwoo.han` | Admin |

Or register fresh with any education-style email (e.g. `jane.doe@student.ks.ac.kr`) and complete the verification code.

---

## 📁 Project structure

```
src/
├─ app/
│  ├─ page.tsx                 # the single route (SPA shell)
│  ├─ globals.css              # design tokens (teal brand, night canvas)
│  └─ api/                     # REST route handlers
│     ├─ auth/                 # login · register · logout · me · google
│     │  └─ email/             # request-code · verify-code (email verification)
│     ├─ projects/[slug]/      # detail, like, bookmark, comments, join…
│     ├─ posts/ users/ departments/ events/ technologies/
│     ├─ likes/ bookmarks/ follow/ reports/ notifications/
│     ├─ moderation/ admin/ search/ stats/
├─ components/
│  ├─ ui/                      # shadcn/ui primitives
│  └─ uniproject/
│     ├─ app-shell.tsx         # header + view switcher + footer
│     ├─ auth-modal.tsx        # sign-in / 2-step verified registration
│     ├─ api-client.ts         # typed fetch client (THE contract)
│     ├─ header.tsx footer.tsx project-card.tsx ui-bits.tsx …
│     └─ views/                # home · projects · detail · community ·
│                              # students · profile · create · settings ·
│                              # notifications · moderation · admin
├─ lib/
│  ├─ config.ts                # university branding, categories, accents
│  ├─ auth.ts                  # scrypt, sessions, safe user mapper
│  ├─ edu-email.ts             # education-email validator (shared client/server)
│  ├─ mailer.ts                # verification-code delivery (console today)
│  ├─ db.ts  types.ts  utils.ts
prisma/
├─ schema.prisma               # User · Session · EmailVerification ·
│                              # Project · Department · Post · Comment · …
└─ seed.ts                     # rich demo data (bun prisma/seed.ts)
db/custom.db                   # SQLite database
```

---

## 🔌 API at a glance

All endpoints return `{ error }` with a 4xx/5xx on failure; authenticated routes read the `up_session` cookie.

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/login` · `register` (requires verify token) · `logout` · `GET me` · Google OAuth |
| Email verification | `POST /api/auth/email/request-code` · `POST /api/auth/email/verify-code` |
| Projects | `GET/POST /api/projects` · `GET/PATCH/DELETE /api/projects/[slug]` · like / bookmark / comments / join / timeline / images / resources |
| Community | `GET/POST /api/posts` · comments · likes |
| People | `GET /api/users` (directory) · `/api/users/[username]` · follow |
| Meta | `GET /api/departments` · `events` · `technologies` · `stats` · `search` |
| Actions | `likes` · `bookmarks` · `follow` · `reports` · `notifications` |
| Staff | `moderation/verifications` (approve/reject) · `admin/**` (departments, events, users, overview) |

---

## 🧹 Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Dev server on port **3000** (log streamed to `dev.log`) |
| `bun run lint` | ESLint (Next.js rules) |
| `bunx tsc --noEmit` | Type check |
| `bun run db:push` | Push `prisma/schema.prisma` to SQLite |
| `bun run db:generate` | Regenerate Prisma Client |
| `bun run build` / `start` | Production build / standalone server |

---

## 🎨 Design language

- **Brand** — Kyungsung crest palette (blue `#005baa`, red `#d71920`, gold `#fcaf17`) with the portal **teal `#0097b2`** as the app primary; dark surfaces use `--up-night: #062530`.
- **Departments** each carry an accent (teal / sky / orange / rose / lime / cyan) used for covers, chips, and the landing cards' hover color-flood.
- Motion is **reduced-motion aware** everywhere (Framer Motion springs degrade to instant states); the layout is mobile-first with a sticky footer and safe-area support.

---

*Built as a student-platform showcase — rebrand it, reseed it, and make it yours.* 🎓
