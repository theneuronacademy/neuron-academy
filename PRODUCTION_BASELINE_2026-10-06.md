# Neuron Academy — Production Baseline Checkpoint
Date (UTC): 2026-10-06
Repo: neuron-academy (branch `main`, 1 commit `64d9599 Initial Neuron Academy production website`)
Checkpoint type: READ-ONLY audit. No functionality modified.

## Verification runs (this checkpoint)

| Check | Command | Result |
|---|---|---|
| Prisma client | `npm run db:generate` | PASS — `Generated Prisma Client (v7.10.0)` in 646ms |
| Lint | `npm run lint` (`eslint .`) | PASS — zero errors, zero warnings |
| Production build | `npm run build` (`next build`) | PASS — compiled in 7.9s, 56 static pages, all API routes dynamic (`ƒ`), middleware 34.4 kB |
| Supabase connectivity | Prisma `$queryRawUnsafe("SELECT version()...")` via pooled URL | PASS — `PostgreSQL 17.11`, db `postgres`, host `aws-0-ap-south-1.pooler.supabase.com`, `CONNECT_OK` |
| Live row counts | `user/student/test/course/book/notification count()` | `3 / 1 / 6 / 1 / 1 / 1` — seeded DB reachable |

Stack: `next 15.5.4 / react 19.1 / prisma 7.10 / @prisma/adapter-pg / pg / tesseract.js / pdfjs-dist / @napi-rs/canvas / bcryptjs / tailwind 3.4`.

Git state at checkpoint: ~80 modified files + ~40 untracked files/dirs on top of the single initial commit. Representative untracked: `app/admin/books/`, `app/admin/test-access/`, `app/admin/tests/generate/`, `app/admin/tests/import/`, `app/api/admin/`, `app/api/auth/*/`, `app/api/books/`, `app/api/students/me/`, `app/api/test-access/`, `app/api/tests/import/`, `app/scholarship-tests/`, `app/student/{attendance,batches,books,marks,profile,register}/`, `lib/{credentials,otp,storageProvider,studentScope,testOrdering,importScope,notify}.ts`, `services/{msg91,ocrService,pdfImport,questionParser,webPush}.ts`, `prisma/scripts/`, `public/uploads/`, `eng.traineddata`. No commit/tag created by this audit (commit only on explicit request).

---

## 1. Working features

Auth (env-gated, honest 503 when unconfigured):
- HMAC session cookie `neuron_session` (`lib/session.ts`): `base64url(payload).hmac_sha256`, 7-day expiry, `HttpOnly; SameSite=Lax; Secure in prod`, `SESSION_SECRET >= 16` enforced.
- Server enforcement (`lib/server-auth.ts`): `requireAuth / requireRole / requireApiRole` → 503 (not configured) / 401 / 403. Fail-closed.
- Edge middleware (`middleware.ts`): protects `/admin/*`, `/faculty/dashboard`, `/student/*`; public logins + public faculty profiles pass through.
- Login/register APIs: `POST /api/auth/login`, `/api/auth/admin/login`, `/api/auth/student/login|register`, `/api/auth/faculty/login|register`, `GET /api/auth/session`, `POST /api/auth/logout`. All tested paths return honest 503 without `DATABASE_URL`/`SESSION_SECRET`.
- OTP plumbing: `POST /api/auth/otp/request|verify`, `GET /api/auth/otp/status` via `services/msg91.ts` + `lib/otp.ts` (peppered SHA-256 hash, never stores plaintext). Returns `MSG91_NOT_CONFIGURED` without creds — no fake success.
- Scholarship/regular scoping (`lib/studentScope.ts`): `getScopedStudent`, `requireRegular` (403 for SCHOLARSHIP on marks/analytics/attendance/batches), allowlist-only profile edits.
- Test gate (`lib/testAccess.ts`): `resolveStudent`, `canStudentAccessTest` / `decideAccess` (FREE open + SCHOLARSHIP bypass, PAID/PRIVATE require ACTIVE unexpired `TestAccess`, lazy EXPIRED marking, DRAFT/INACTIVE hidden as 404), `isLiveWindowOpen`, batch checks.

Student (fully API-wired, no demo fallback):
- `app/student/dashboard/page.tsx` → `/api/students/me/analytics` + `/api/tests` + `/api/notifications/mine` + `/api/books`, charts (`components/student/charts.tsx`).
- `marks` → `/api/students/me/marks`, `attendance` → `/me/attendance`, `batches` → `/me/batches`, `books` → `/api/books`, `profile|photo` → `/api/students/me/profile|photo`.
- Test attempt core: `POST /api/tests/[id]/attempt|submit`, `GET /api/tests/[id]/review`, `components/student/DbAttempt.tsx` + `services/testApi.ts` (pure fetch, honest `{ok:false,reason}`).

Books (admin + student): `app/admin/books` CRUD via `/api/admin/books` + `/api/admin/books/upload`; `app/student/books` via `GET /api/books` (scholarship `visibleTo=ALL` filter server-side). Honest empty states.

OCR / PDF import pipeline (server-real):
- `POST + GET /api/tests/import/pdf`, `GET+DELETE /api/tests/import/[id]`, `POST .../approve|reject`, `GET .../questions`, `PATCH .../questions/[questionId]`.
- Backed by `services/pdfImport.ts` (`pdfjs-dist/legacy`, `TEXT_THRESHOLD=40`), `services/ocrService.ts` (`TesseractOcrProvider` + `rasterizePdfPage` via `pdfjs-dist` + `@napi-rs/canvas`), `services/questionParser.ts` (HIGH/MEDIUM/LOW, 2–5 options, OCR-tolerant). UI pages `admin/tests/from-pdf`, `admin/tests/import/[id]`, `admin/tests/generate` (`POST /api/tests/generate`) are wired.
- `next.config.mjs`: `serverExternalPackages: [@napi-rs/canvas, tesseract.js, pdfjs-dist]` — correct (kept out of webpack bundle).

Public site: `/`, `/courses/[slug]` (SSG jee/neet/amu +2), `/faculty/[slug]`, `/scholarship-tests` (server Prisma `PUBLISHED|LIVE × FREE|PAID`, `revalidate=60`), `robots.ts`, `sitemap.ts`, `layout.tsx` SEO metadata, `GET /api/health` (always 200 + `database:connected|not-configured|unreachable`), `GET /api/public/tests` (metadata only, no Q/A).

## 2. Partially implemented features

Test engine — dual engine (API-real path exists, localStorage still primary on most pages):
- API-real: `testApi.startAttempt/submitAttempt/getTests/getQuestions`, `DbAttempt.tsx`, server `lib/evaluation.ts` used by `submit|review` routes.
- Local-primary: `app/student/tests/page.tsx`, `tests/[id]/page.tsx` (`getTestById`, `draftKey`, local `evaluateTest` authoritative + fire-and-forget mirror), `tests/[id]/result/page.tsx`, `app/admin/tests/*` (list/edit/configure/preview/questions), `app/admin/question-bank`, `app/admin/results`. Services `questionService.ts / resultService.ts / testService.ts` (local CRUD + `mirrorCreate/mirrorStatus/mirrorDelete`) and `services/notificationService.ts` are local-only.

Admin dashboard (`app/admin/dashboard`): `getDashboardStats` (live `/api/dashboard/stats`), `getUpcomingTests`, `getEnquiries`, `liveStats` (totalTests/published/live/results/attempts) live. BUT `getRecentActivity` (`TODO GET /api/activity`), `getAttendanceOverview` (`TODO GET /api/attendance/overview`), `getWebsiteStatus` (derive from health), `Today's Attendance %` (`DEMO_*`), "Add Student" QuickAction demo toast, auth via client `lib/adminAuth.ts` localStorage (`TODO replace with server session`) remain demo.

Admin website CMS: list reads API-first (`getBanners/getPopups/getAnnouncements` with demo fallback) work; writes are local-only demo: `website/banners|popups|gallery|testimonials|results` (`Result added (demo)`), `website/faculty` (`Saved demo`), `website/courses` (`demo — backend sync later`), `website/announcements` (`published demo`). Hub notes "Edits here are UI demos in Phase 2". `advertisements/*` 100% `mockStore` localStorage.

Admin people: `students|faculty|test-access|question-bank|results|batches|enquiries|attendance` reads wired (`/api/students`, `/api/faculty`, `/api/questions`, `/api/tests`, `/api/results`, `adminApi` live reads). Writes mixed: `students` PATCH real; `batches` Create `(demo)`, `faculty` onboard `(demo)`, `attendance` Sync `(demo)`, `enquiries` status `(demo)`, `results` Export UI-only demo, `notifications` send local-only.

Faculty dashboard: Phase-4 BASIC shell only. Session guard + logout real; only `OfflineMarksForm` (gated by `services/dbLive.isDbLive()`) wired. `Assigned Batches` static ("arrive in Phase 5"); `facultyApi.getFacultyBatches` = `TODO GET /api/batches?facultyId=`.

Notifications: student `app/student/notifications` tries `/api/notifications/mine` (read + PATCH mark one/all) then falls back to `lib/storage` local feed — offline/demo branch intact. Admin send is local-only (see §3).

Analytics: student trend/attendance real; admin `Attendance Overview` + `Recent Activity` + `Today's %` are `DEMO_*`; only `liveStats` real.

`services/siteApi.ts`: `getCourses/Faculty/Gallery/Banners/LiveBanners/LivePopups/submitEnquiry` DB-first with `data/*`/`mockStore` fallback; `getResults/getFAQ/getSiteSettings` demo-only. `services/studentApi.getStudentAttempts` = `never[]` stub; `services/questionExtraction`: `PDFTextProvider` real, `OCRProvider`/`AIQuestionProvider` honest throwing stubs (`getActiveProvider()="pdf-text"`); `services/webPush`: subscribe/unsubscribe real (Prisma), `sendNotification` honest stub.

## 3. Broken features

1. Admin notifications send does not deliver: `app/admin/notifications/page.tsx:send()` only prepends to local `rows` + `(demo)` toast — no `POST /api/notifications`. `notificationService` local-only. History list works; delivery/scheduling does not.
2. Web/Mobile push delivery not installed by design: `webPush.sendNotification` returns `WEB_PUSH_NOT_CONFIGURED` / `WEB_PUSH_PROVIDER_MISSING`. Rows stored (`IN_APP` delivered; `WEB_PUSH`/`MOBILE_PUSH` stored only). Subscription APIs (`GET+POST+DELETE /api/push/subscribe`) work; no provider sends.
3. `services/studentApi.getStudentAttempts` returns `never[]` (`TODO backend: GET /api/attempts?studentId=`). Any UI depending on it shows empty.
4. Overexposure bugs (functional, flagged in API audit):
   - `GET /api/tests/[id]` anonymous branch can return full row incl. answer keys without `canStudentAccessTest` — unlike list route. Probeable by ID.
   - `GET /api/faculty` public leaks `email/phone` while `GET /api/faculty/[id]` requires ADMIN — inconsistent.
   - `GET /api/announcements/[id]` requires ADMIN while sibling CMS detail GETs (`banners|gallery|popups|testimonials|courses|batches`) are public — inconsistent contract.
   - `GET /api/results`, `GET /api/questions` no-DB path returns `200 demo []` instead of honest 503 (unlike `attempts|books|public/tests`).
5. No CI/CD, no prod migrate path: missing `Dockerfile`, `vercel.json`, `.github/` workflows, `db:migrate:deploy` script (only `db:push`/`migrate dev`). `SeedInit.tsx` seeds demo content unless `NODE_ENV==production`; `cleanup-demo.ts`/`create-admin.ts` have no prod guard beyond docs.

## 4. Production risks (ordered by severity)

1. Uncommitted work + no checkpoint tag: entire Phase 4–14 delta sits in working tree/untracked files. Any machine loss, `git clean`, or partial commit loses production code. Mitigation: commit checkpoint now (explicit approval needed), then tag.
2. `SESSION_SECRET` demo bypass is fail-open: `middleware.ts:56-58` `if (!secret || len<16) return NextResponse.next()` disables all edge protection; page guards fall back to client localStorage (`adminAuth`/`studentAuth` hardcoded `admin@neuronacademy.in:neuron123` / `student@neuronacademy.in:student123`). Safe only because `.env` currently has 64-char secret; staging/preview envs without it are wide open.
3. No `prisma/migrations/` directory (verified absent): schema deployed via `db push`-style flow. No migration history, no `migrate deploy` for prod, drift risk between `schema.prisma` and Supabase. `DIRECT_URL` missing so pooled URL cannot run migrations reliably.
4. Live secrets in `.env` (git-ignored, but present in workspace): pooled Supabase `DATABASE_URL` + 64-char `SESSION_SECRET` in plaintext 203B file. Safe for push (`git check-ignore` confirms ignored; only `.env.example` tracked) but unsafe for snapshots/sharing. No rotation documented.
5. Storage defaults to ephemeral local: `STORAGE_PROVIDER` unset → `lib/storageProvider.ts` writes `public/uploads/photos|covers/` (sample files already committed). Ephemeral on Vercel/serverless, publicly served, no lifecycle. Supabase path uses `POST` not `PUT` + returns public URL even for "private bucket" comment; `removeLocalUpload` no-ops for Supabase.
6. Native OCR binary on serverless: `@napi-rs/canvas` + `rasterizePdfPage scale=2` is memory-heavy, no timeout/queue; will fail on Vercel serverless without Docker/custom layer. `eng.traineddata` 5.2 MB at repo root is untracked orphan (code uses `tesseract.js` WASM CDN `createWorker("eng")`, not this file) — bloats builds if committed.
7. Hardcoded demo creds in code/scripts: `DEMO_ADMIN:neuron123`, `student123`, `seed demo1234`, `DEMO_*` fallbacks returned as `200 source:demo` on public reads. Fine for resilience, but demo data can leak into prod analytics if DB drops.
8. Missing deployment config: no `Dockerfile`, `vercel.json` (headers/caching), `.github` CI (lint/build/migrate/seed), `healthcheck`, `crons`, `output/fileTracing` for `eng.traineddata`, `metadataBase/canonical/icons/viewport/OG images/JSON-LD` in `layout.tsx`, DB-backed `sitemap.ts`.

## 5. Duplicate / legacy code

- Storage ×3: `lib/storage.ts` (`neuron_questions/tests/attempts/results/notifications` localStorage, primary for 20+ pages) vs `lib/prisma.ts` + `schema.prisma` (19 models, production path) vs `lib/storageProvider.ts` (upload binaries, `local` default). Bridge: `services/dbLive.isDbLive()` + `testService.mirror*` fire-and-forget dual-write — not a cutover.
- Seeds ×3: `lib/mockStore.ts` (`neuron_ads_v1`, `seedAds`, used by Hero/Banners/Carousel/Popup + `admin/advertisements/*` + `siteApi` fallback; re-exported via `storage.ts`) vs `lib/seed.ts` (`ensureSeeded`, `DEMO_QUESTIONS[20]`, mounted by `SeedInit.tsx`) vs `prisma/seed.ts` (DB upserts `*@demo.local`, banners/popups/gallery/testimonials/enquiries/notifications/tests, mirrors `data/courses.ts`). No single seed.
- `data/` vs DB: `lib/websiteData.ts` shim (`export * from @/data/*`, "new code should import directly") — both import styles live. `data/*.ts` (`site,hero,courses,faculty,gallery,testimonials,results,faq,social,contact,banners,popups,admin:DEMO_*`) vs Prisma `Course/Faculty/GalleryItem/Testimonial/Banner/Popup/Announcement/Enquiry/Notification`. Routes return `ok({items:DEMO_*,source:"demo"})` when `!db`.
- Test engines: eval `services/resultService.evaluateTest` (client, `accuracy` + `Math.round(*100)/100`) vs `lib/evaluation.ts:evaluateAnswers` (server, `round2`, used by submit/review); CRUD `questionService/testService` (local) vs `/api/tests/*|questions/*` (Prisma) + `services/dbQuestionMap.ts` (hardcodes `subject:"Database",difficulty:"Medium"`); PDF parse `lib/test/pdfParser.ts` (client CDN worker) vs `services/pdfParser.ts` (4-line re-export shim) vs `services/pdfImport.extractPdfText` (server legacy build) vs `services/questionParser.parseQuestionsFromPages` (Phase-12 server) vs `services/questionExtraction.ts` (abstraction + 2 stubs) vs `services/ocrService.ts`.
- Auth ×7: server `lib/session.ts` + `lib/server-auth.ts` (correct) vs client `lib/adminAuth.ts` (`ADMIN-001:neuron123`) + `lib/studentAuth.ts` (`student123`) + `useAdminGuard`/`useStudentGuard` vs scattered `lib/credentials.ts` (bcrypt+pepper), `lib/otp.ts`, `lib/ownership.ts` (2 TODOs: faculty batch-student view, grading audit), `lib/testAccess.ts` (~40-line FREE/GRANT duplication), `lib/testOrdering.ts`, `lib/studentScope.ts`, `lib/importScope.ts`.
- Stale `TODO auth` comments in 18 `route.ts` files (writes already enforce `requireApiRole` — comments obsolete): `banners`, `banners/[id]`, `announcements`, `batches`, `batches/[id]`, `courses`, `courses/[id]`, `faculty`, `faculty/[id]`, `gallery`, `popups`, `popups/[id]`, `testimonials`, `students`, `students/[id]`, `notifications`, `enquiries`, `auth`.

## 6. Missing environment variables

`.env` currently sets 2/16 checked keys: `DATABASE_URL` SET (105ch, pooled), `SESSION_SECRET` SET (64ch). Everything else MISSING:

| Var | Status | Effect when missing (observed) |
|---|---|---|
| `DIRECT_URL` | MISSING (commented in example) | `prisma.config.ts` falls back to `localhost:5432`; pooled URL cannot `migrate` reliably |
| `MSG91_AUTH_KEY / TEMPLATE_ID / SENDER_ID / OTP_EXPIRY` | MISSING | OTP APIs return `MSG91_NOT_CONFIGURED`; registration keeps legacy flow |
| `VAPID_PUBLIC_KEY / PRIVATE_KEY / SUBJECT` | MISSING | `GET /api/push/subscribe` returns 503; push never sends |
| `STORAGE_PROVIDER / SUPABASE_URL / SUPABASE_SERVICE_KEY / STORAGE_BUCKET` | MISSING (commented) | Uploads stay `local` (`public/uploads/`, ephemeral) |
| `NEXT_PUBLIC_SITE_URL` | MISSING (not in example; used in `robots.ts/sitemap.ts`) | SEO canonical falls back to `https://neuronacademy.in` — drifts if domain differs |
| `NEXT_PUBLIC_WHATSAPP_URL` | MISSING (not in example; used in `courses/[slug]`) | CTA falls back to `"#enquire"` |
| `NODE_ENV` | standard (used in `session/mockStore/SeedInit`) | `mockStore` seeds demo ads in non-production — expected |

Fix: copy `.env.example` → `.env`, generate secret (`openssl rand -base64 48`), set pooled `DATABASE_URL` + non-pooled `DIRECT_URL`, configure Supabase bucket or accept ephemeral local + persistent volume, add the two `NEXT_PUBLIC_*` keys to the example.

## 7. Database schema status

Prisma 7, `provider = postgresql`, 19 models, 15 enums. No `prisma/migrations/` — schema applied out-of-band (`db push` style), no migration history.

Models: `User` (incl. `dobHash` Phase-10, relations to tests/imports/notifications/announcements/accesses/push), `Student` (incl. `StudentType REGULAR|SCHOLARSHIP`, profile fields, `@@index(studentType,status,batchId)`), `Faculty`, `Course` (catalogue fields `category/target/mode/facultyName/badge/accent/subjects/highlights`), `Batch`, `Banner`, `Popup` (`PopupFrequency`), `GalleryItem`, `Testimonial`, `Result` (server breakdown `attempted/correct/wrong/unanswered`), `TestAccess` (`@@unique(testId,studentId,status)` — one ACTIVE per pair), `Test` (`TestType LIVE|OFFLINE|PRACTICE`, `TestStatus DRAFT|SCHEDULED|LIVE|COMPLETED|PUBLISHED`, `questionOrder|optionOrder SERIAL|RANDOM`, `TestAccessType FREE|PAID|PRIVATE`, `price` rupees), `Question` (`QuestionType MCQ|TRUE_FALSE|SHORT_ANSWER|NUMERIC`, `optionA–E`, `subject/sourceFile/sourcePage/confidence`, `reviewStatus PENDING|APPROVED|REJECTED`), `TestAttempt` (`answers/questionOrder/optionMap Json`, `AttemptStatus`), `PdfImport` (PROCESSING→COMPLETED|REVIEW_REQUIRED|FAILED + counters), `Attendance` (`@@unique(studentId,date)`, `AttendanceSource MANUAL|BIOMETRIC` + `deviceId` reserved for eSSL), `Notification` (`NotificationAudience`, `NotificationChannel IN_APP|WEB_PUSH|MOBILE_PUSH`, read state, `testId` deep link, targeting), `OtpRequest` (hashed OTP only), `PushSubscription`, `Book` (`BookVisibility ALL|REGULAR_ONLY`, `isActive`), `Enquiry`, `Announcement`.

Indexes present on all hot paths (`testId`, `studentId`, `status`, `accessType`, `publishedAt`, `batchId`, `channel`, `audience`, `createdAt`, `className/subject/category`). No schema errors — `db:generate` clean, live queries succeed.

## 8. API status — 73 `route.ts` files

Auth 12: `auth`, `auth/login|logout|session`, `auth/student/login|register`, `auth/faculty/login|register`, `auth/admin/login`, `auth/otp/request|status|verify`. All env-gated, honest 503.
Tests 13: `tests` (GET+POST), `tests/generate`, `tests/[id]` (GET+PATCH+DELETE), `tests/[id]/attempt|submit|review`, `tests/import/pdf` (POST+GET), `tests/import/[id]` (GET+DELETE), `.../approve|reject`, `.../questions`, `.../questions/[questionId]`, `public/tests`. All `requireApiRole` except list/detail GETs which scope by role + `canStudentAccessTest`.
Content/CMS 10: `banners|gallery|announcements|testimonials|popups` (+`[id]`). GET public demo; writes ADMIN-only.
Students 9: `students`, `students/[id]`, `students/me`, `me/profile|photo|marks|analytics|attendance|batches`. `me/*` STUDENT-scoped, REGULAR-only where applicable.
Faculty 3: `faculty` (GET public demo + POST ADMIN), `faculty/[id]` (ADMIN), `faculty/me` (FACULTY-only).
Batches/Courses 5: `batches`, `batches/[id]`, `batches/[id]/students`, `courses`, `courses/[id]`. GETs public; writes ADMIN.
Results/Attempts/Attendance 5: `results` (GET scoped + POST FACULTY/ADMIN), `results/[id]`, `results/offline`, `attempts` (scoped GET), `attendance` (ADMIN/FACULTY).
Questions 2, Test-access 2 (`GET+POST`, `PATCH+DELETE` ADMIN; student-own GET scoped), Notifications 3 (`notifications` ADMIN, `[id]` ADMIN, `mine` scoped GET+PATCH), Books 4 (`books` public+scholarship filter, `admin/books` + `[id]` + `upload` ADMIN), Enquiries 2 (POST public, rest ADMIN), Dashboard 1 (`dashboard/stats` ADMIN), Push 1 (`push/subscribe` GET public VAPID + POST/DELETE authed), Health 1 (always 200). No `app/api/ocr/*` — OCR lives under `tests/import/pdf`.
Honest-503 coverage: `requireApiRole` 503 on all protected routes + `dbNotConfigured` 503 on writes + `isAuthConfigured` 503 on logins + MSG91/webPush 503s. Demo `200 source:demo` read-only fallbacks intentional on website lists. Flags: see §3 item 4.

## 9. UI issues

- Demo strings visible in admin: `"Sync Attendance (demo)"`, `"Batch created (demo)"`, `"Settings saved (demo — backend sync later)"`, `"8 placeholder photos"`, `"4 demo quotes/selections"`, `TODO backend: GET /api/...` in batches/testimonials/results/gallery/faculty/popups pages; `data/admin.ts:DEMO_*`, `mockStore seedAds["SSC CGL 2027","JEE Main Test Series"]`, `lib/seed 20 Percentage Qs`.
- Placeholder images: `lib/siteImages.tsx:SmartImage` falls back to gradients; `public/images/` has only `logo.png (+duplicate logo.png.jpeg)` + two `WhatsApp Image 2026-10-02 at 9.01...pm.jpeg` (spaces break URL conventions). All `hero/about/course-*/faculty-*/gallery-*` missing → every visitor sees gradients. Uses raw `<img>` (no `next/image`, no `sizes`, no `width/height` → CLS) + eslint-disable.
- Public-asset hygiene: delete/rename `logo.png.jpeg` duplicate + WhatsApp dumps; add `metadataBase/canonical/icons/viewport/themeColor/OG images/JSON-LD`; `sitemap.ts` omits `/courses`, `/faculty`, `/scholarship-tests` + DB slugs (currently `data/*`-only).
- Accessibility (good `aria-*` in Navbar/Hero/Banners/Testimonials/Faq/QuestionCard/AdminModal; gaps): icon-only `<button>` without `aria-label` in `admin/tests/[id]/questions`, `faculty/dashboard`, `student/*`; `AdvertisementPreview <img alt=title>` no fallback when `mediaUrl=""`; color-only status dots (`AdminStatusBadge` dot `aria-hidden` without text alternative in tables); `marquee aria-hidden` hides announcements from SR; several admin filter inputs `placeholder`-only (missing `label htmlFor`); `text-silver-200 on light` contrast fail in attendance subtitle.

## 10. Recommended implementation order (no rebuild, smallest risk first)

1. Checkpoint commit + tag (explicit approval): `git add -A && git commit && git tag baseline-2026-10-06`. Nothing else is safe until the tree is pinned. Then `gitignore` + remove `eng.traineddata` (or document download) and `logo.png.jpeg`/WhatsApp dumps.
2. Migrations foundation: `prisma migrate dev --name baseline` against a non-pooled `DIRECT_URL`, commit `prisma/migrations/`, add `db:migrate:deploy` script + CI (`lint → generate → build → migrate deploy --dry`). No schema change — just history.
3. Env completion: add `DIRECT_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_URL` to `.env.example`; set `STORAGE_PROVIDER` decision (Supabase bucket + `SUPABASE_*` or documented ephemeral-local + volume); add MSG91/VAPID creds or record "deferred" so 503s are expected.
4. Close overexposure gaps (§3.4): gate `tests/[id]` anon with `canStudentAccessTest`, strip PII from public `faculty` list (or require ADMIN), align `announcements/[id]` GET with siblings, return 503 (not demo `[]`) on `results|questions` no-DB.
5. Cut test engine over (one page at a time, keep mirror until green): `student/tests` list → `testApi.getTests`; `tests/[id]` attempt → `DbAttempt` + server submit; `result` → `/api/results` + `/review`; then `admin/tests` + `question-bank` + `results` writes. Delete `mirror*` only after parity. Single eval source (`lib/evaluation.ts`).
6. Wire admin writes that are currently demo toasts: notifications `POST /api/notifications` (+ scheduler), batches create, faculty onboard, attendance sync, enquiries status, CMS writes, results export. Remove `TODO auth` comments as each is verified.
7. Faculty dashboard Phase-5: `GET /api/batches?facultyId=` + assigned-batch students (completes `ownership.ts` TODOs) + grading audit log.
8. Storage + OCR for prod: decide Supabase bucket (fix `POST`→`PUT`, private-bucket URLs, `removeLocalUpload`), add OCR timeout/queue + Docker/layer for `@napi-rs/canvas`, document `eng.traineddata` source.
9. UI polish: real `public/images/*` set (or `next/image` + proper fallback), asset renames, `layout.tsx` metadata completion, DB-backed sitemap, a11y pass (labels, button names, badge text, marquee alternative, contrast).
10. De-duplication last (after behavior pinned by tests): single seed (`prisma/seed.ts`), single storage truth, single PDF-parser entrypoint, single eval, retire `mockStore`/`websiteData` shims behind `isDbLive` flags.

---
*Generated read-only. No source files changed by this audit. Build/lint/db-verify outputs quoted verbatim above.*
