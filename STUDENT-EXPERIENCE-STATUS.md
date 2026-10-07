# STUDENT-EXPERIENCE-STATUS.md — Phase 16 production pass

Complete Neuron Academy student experience. Server is authoritative for
everything; the browser only renders. No localStorage authority for
tests, attempts, results, scores, eligibility, grants, attendance,
marks, or analytics.

## 1. Student access model

Enforced server-side on every route (`lib/testAccess.ts`,
`lib/studentScope.ts`). Never trusted from the client; hidden UI is
display-only.

**REGULAR** — dashboard, profile, notifications, books, FREE tests,
explicitly granted PAID tests, explicitly granted PRIVATE tests,
assigned batch, attendance, marks, analytics.

**SCHOLARSHIP** — dashboard, profile, notifications, books (ALL
visibility only), FREE tests (any batch — server bypass, FREE-only),
granted PAID/PRIVATE scholarship tests. No automatic regular
batch/attendance/marks/analytics access: those routes return 403 via
`requireRegular`.

Admin controls student type, mobile, email, batch, status. Students edit
only the allowlist (`name, photoUrl, gender, address, city, school,
className, parentName, parentMobile`); protected fields
(`mobile/phone/email/studentType/status/batchId/courseId/
enrollmentDate/joiningDate`) are rejected with 403.

## 2. Regular vs scholarship rules

- `getScopedStudent` resolves the caller's own profile + server-side type.
- `requireRegular` gates `/me/attendance`, `/me/marks`, `/me/batches`,
  `/me/analytics` (403 otherwise).
- `decideAccess`/`canStudentAccessTest`: SCHOLARSHIP bypasses the batch
  rule for FREE tests only; PAID/PRIVATE always need an ACTIVE unexpired
  `TestAccess` grant regardless of type.
- Book catalogue filters `visibleTo: ALL` for scholarship students
  server-side; `REGULAR_ONLY` never reaches them.

## 3. Test access

`TestAccessType`: FREE (open to eligible students), PAID (ACTIVE grant
after external UPI confirmation — no gateway), PRIVATE (invite-only
grant). Expired/revoked denies (403/410); DRAFT/inactive hides as 404;
PRIVATE without grant hides as 404 (no probing). Catalogue
(`GET /api/tests`) never includes questions. `GET /api/tests/[id]` for
students returns metadata + key-stripped questions only after the full
gate. Anonymous callers get a uniform 401 before any DB lookup (no
id-existence oracle).

No unlock via URL/body/query/localStorage/client-state manipulation:
every mutation re-resolves the session profile and re-checks
`canStudentAccessTest` (including mid-attempt revocation on submit).

## 4. Attempt / submission flow

`POST /api/tests/[id]/attempt` (STUDENT-only): resolves profile,
visible-status check, batch rule (+ FREE scholarship bypass), access
gate, live-window check (server clock; OFFLINE never opens), single
active attempt (SUBMITTED/EVALUATED → 409, IN_PROGRESS → resume).
Server generates per-attempt `questionOrder`/`optionMap` once
(RANDOM-safe, refresh-stable).

Questions (`GET /api/questions?testId&attemptId`) are assembled via
`assemblePaper` — display letters only, no `correctAnswer`, no
`explanation`. The client sends only `{ attemptId, answers }`; the
server inverts the stored `optionMap`, evaluates with `evaluateAnswers`
over DB keys/marks/negative marks, persists score/total/percentage and
upserts the `Result`. Client-supplied scores are never read. Attempt
binding (`attempt.testId` + `attempt.studentId == profile.id`,
`IN_PROGRESS` only) blocks forged attempt IDs. 5-option (A–E) answers
score and review correctly (`normalizeAnswer` accepts A–E / 0–4).

UI (`DbAttempt`): instructions → attempt → confirm-submit modal
(answered/unanswered/marked counts) → server submit → result page.
Timer auto-submits at 00:00; `beforeunload` guard prevents accidental
navigation loss; sticky header wraps on small screens; palette and modal
scroll safely.

## 5. Result flow

Students read only own rows (`where: { studentId: profile.id }`; client
`studentId` ignored; single-result fetch checks ownership → 404).
`GET /api/results` (+ `?testId=`) returns score breakdown; no keys.
Post-submit review (`GET /api/tests/[id]/review`) requires an own
SUBMITTED/EVALUATED attempt + current access, and only then returns
`correctAnswer/yourAnswer/marksAwarded`. Pages: `/student/results`
(index) + `/student/tests/[id]/result` (detail + review). No rank is
invented (`rank ?? null`).

## 6. Attendance

`GET /api/students/me/attendance?month=` (REGULAR-only, ownership
forced, `take: 200`, strictly validated month). Summary is all-time
(groupBy); items are month-filtered. `source` preserves MANUAL vs
BIOMETRIC semantics; `deviceId`/biometric payloads are never selected.
Read-only for students. Empty/scholarship/inactive/batchless states are
honest cards, never fabricated.

## 7. Marks

`GET /api/students/me/marks` (REGULAR-only, ownership forced,
`take: 300`): class tests (batched FREE) / scholarship tests (unbatched
FREE) / other (paid/private/offline) — presentation grouping only.
No forged marks; no cross-student access; empty state when none.

## 8. Analytics

`GET /api/students/me/analytics` (REGULAR-only): 4 parallel aggregates
(results ≤500, attempt groupBy, attendance groupBy, recent 12) — no N+1,
no per-row fetching. Returns attempted/completed/in-progress,
average/highest/lowest, trend, attendance totals + percentage, else
honest `null`s. No rank, percentile, prediction, AI insights, or
weak-topic analysis. Pages: dashboard cards + `/student/analytics`
(full page, graceful no-data state).

## 9. Books

`GET /api/books`: active books only; scholarship sees `visibleTo: ALL`;
search/class/subject/category filters; bounded `take: 200`. File bytes
stay in storage — the API returns resolved cover/PDF URLs via the
existing Supabase provider; no service keys leave the server.
Missing/deleted files resolve gracefully (null URL → "Resource coming
soon"). Student page: search + filters, responsive grid, honest empty
state.

## 10. Notifications

Phase 15 system retained and hardened (Phase 16 fix below). Student feed
(`GET /api/notifications/mine?limit=` bounded 1–100) returns SENT-only
rows targeted at self / own batch / ALL_STUDENTS + per-user
`unreadCount`. PATCH `{id}` / `{all:true}` derives identity from the
session and is scoped to the caller's visible set (foreign IDs → 404).
Faculty has a parallel faculty-scoped branch. ADMIN history stays
ADMIN-only.

**Phase 16 fix — per-user read receipts:** `Notification.isRead` is a
single shared column, so marking a broadcast (ALL_STUDENTS/BATCH) read
cleared unread state for every recipient. Added `NotificationRead
(notificationId, userId)` (migration
`20261007000000_notification_reads`). Broadcasts now record one receipt
per reader; the shared flag flips only for individually-targeted rows
(single recipient — safe). GET overlays receipts for `isRead` and
computes `unreadCount` per user. The student page is API-authoritative:
no localStorage read authority (offline cache is labelled read-only,
mark-read never touches it).

## 11. Profile

`GET/PATCH /api/students/me/profile` (STUDENT-only, own profile):
allowlist updates with validation (name ≥ 2 chars, photoUrl scheme
allowlist rejecting `/object/sign/`, gender enum, parentMobile format);
unknown keys ignored; empty patch → 400; syncs `User.name` only.
Photo (`POST/DELETE /api/students/me/photo`): JPG/PNG/WebP, 2 MB,
magic-byte + extension validation, server-generated filename,
fail-closed delete (storage failure → 502, link kept), best-effort
previous cleanup reported honestly. Role/type/batch/status/password
hash/session internals are never client-writable.

## 12. Security model

- Anonymous → student APIs: 401 (uniform, before DB reads).
- Faculty → student-private APIs: 403 (role gates + `requireRegular`).
- Student A → Student B profile/results/attendance/analytics: blocked
  (session-derived ownership on every query; 403/404, no enumeration).
- Unassigned batch: 404 via `batchAllowed` (no probing).
- Scholarship → unauthorized regular data: 403 (`requireRegular`).
- Scholarship → unauthorized paid/private: locked/hidden (grant gate).
- Grants/results/attendance/type/batch/status cannot be forged
  (server-resolved identity; no client-trusted IDs or scores).
- Answer keys: never pre-submit (stripped in detail/questions/paper
  paths; E-option review included post-submit only).
- Unpublished/deleted tests: 404 (never 403-leak).
- URL/query/body ID tampering: blocked (attempt/result/notification
  binding checks).
- Checks: `npm run security:check` (auth + access + scope + C1–C6
  canonicalization), `npm run notification:check` (15 groups incl.
  per-user receipts), `npm run student:check` (74 checks: regular /
  scholarship / FREE / PAID / PRIVATE / ownership / allowlist /
  non-authority).

## 13. Responsive UX

Desktop / tablet / mobile audited. Sticky attempt header wraps; question
text and options break words; option buttons ≥44px targets; palette
grid scrolls; submit confirmation is a scroll-safe modal; cards use
`min-w-0` + truncation; trend charts sit in `overflow-x-auto`; tables
avoided in favour of responsive grids; skeleton loading, honest empty,
403, 404, and retryable error states on every student page; `role=alert`
errors, `aria-pressed`/`aria-label` controls. No excessive animation.

## 14. Performance

Dashboard/analytics/batches use parallel aggregates with `select`,
bounded `take` (100/200/300/500/2000-cap for receipt scans), pagination
via `limit` on notifications; no N+1 (single `findMany` + `include`
where needed); no duplicate fetches per page (one effect per family).
Books URL resolution remains per-row (bounded 200) — noted below.

## 15. Known limitations

1. Marks/analytics truncate at `take: 300/500` — extreme histories
   (>300 results) skew averages; no cursor pagination yet.
2. Books resolve cover/PDF URLs per row (`Promise.all`, ≤200) — no
   signing cache yet; fine at current catalogue size.
3. `NotificationRead` needs `prisma migrate deploy` in environments
   created before `20261007000000_notification_reads`; code degrades
   gracefully (receipts skipped, broadcasts stay unread) until applied.
4. Scholarship students see PAID test metadata as locked rows (titles /
   price) — by design (consistent with catalogue lock reasons); question
   data stays gated.
5. Offline test-taking is not supported (server engine only); the
   notifications offline view is read-only cache.
6. No cursor pagination on results/marks/books feeds yet (fixed takes).
7. K90/ADMS/biometric protocol untouched — attendance `source` semantics
   preserved; no biometric payload exposure added.
