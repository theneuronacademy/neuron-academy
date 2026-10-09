# ADMIN-MODULE-STATUS.md — Phase 17 production pass

Complete Neuron Academy Admin Panel. Server is authoritative for
everything; the browser only renders. No localStorage authority for
admin mutations. Phase 15 notification system and Phase 16
NotificationRead retained.

## 1. Admin authorization

Every management endpoint enforces ADMIN role via
`requireApiRole(req, ["ADMIN"])` (lib/server-auth.ts). Session from
HMAC-signed `neuron_session` cookie; role never trusted from body/query.

Anonymous → 401, Student → 403, Faculty → 403, Admin → allowed.
No role/id trust anywhere.

IDOR guarded: every mutation derives identity from session cookie.
URL/body ID tampering blocked (owner checks, scope checks).

## 2. Admin dashboard

`/admin/dashboard` page reads live stats from `/api/dashboard/stats`
(11 parallel counts + activity/enquiries/upcoming tests). Demo fallbacks
labelled "Demo data" — no fake numbers.

Stats: total/active students, total/active faculty, active batches,
published tests, pending enquiries, today's attendance %.

## 3. Student management

`/admin/students` — search, type/status/batch filters, client pagination
(20/page). Edit modal: type (REGULAR/SCHOLARSHIP) with 2-step confirm,
status, batch, phone, email, city, school, className. Protected fields
never exposed.

DELETE: 409 with dependent counts (results/attendance/attempts/grants)
— never silently orphans history. Deactivate instead.

Type change immediately affects server-side access rules via
`requireRegular`/`decideAccess`.

## 4. Faculty management

`/admin/faculty` — search, status filter, client pagination. Edit modal
with real contact fields (email, phone) — no fabricated contacts.

DELETE: 409 if batches assigned. Toggle status via PATCH `/api/faculty`
(status field). No password hashes exposed.

## 5. Course + batch management

Courses: `/admin/website/courses` — add/edit/delete. Admission toggle
persists via course `status` PATCH. DELETE: 409 if batches/students/
enquiries depend.

Batches: `/admin/batches` — create with explicit course/faculty
selection. Edit: faculty + status. DELETE: 409 if students/tests/
attendance exist — mark COMPLETED instead.

Course/batch APIs enforce dependency checks.

## 6. Test management

`/admin/tests` — list, create, duplicate, delete. Duplicate via POST
`/api/tests`, delete 409 if attempts/results/grants exist.

Test CRUD via `/api/tests/[id]` (PATCH/DELETE). Publish gate
`validatePublishable` — questions, marks, keys, batch required.
Unpublish supported.

Faculty scope: `facultyMayManageTest` — only own/assigned-batch tests
read keys / edit questions. ADMIN bypasses.

Question management: `/admin/tests/[id]/questions` — add/edit/reorder/
delete via `/api/questions`. Faculty scope enforced on create/edit/
delete.

Import review: `/admin/tests/import/[id]` — approve/reject with
confirmations. Bulk actions confirm.

Generate test: `/admin/tests/generate` — pool → test, access type
(FREE/PAID/PRIVATE + price).

## 7. Question bank + PDF/OCR

`/admin/question-bank` — create/edit/delete/copy-to-test. No demo
fallback — "Question bank unavailable" if DB down.

PDF import: `/admin/tests/from-pdf` — upload → `/api/tests/import/pdf`.
OCR boundary: `ocrEnabled()` gate, honest 422 if unavailable (no
speculative claims). 10MB/50-page/10-OCR-page caps unchanged.

Review pipeline: staging test → questions with `reviewStatus` →
approve/reject → approved questions enter pool.

## 8. Access grants (PAID/PRIVATE)

`/admin/test-access` — grant/revoke, search students, filter by test,
expiry datetime. Revoke: explicit confirm, immediate lockout.

Duplicate ACTIVE grants blocked (409). Revoked/expired grants cleaned
on new grant.

## 9. Results + attendance

Results: `/admin/results` — search, test filter, manual entry form +
offline CSV validator (shape only, no save). Export CSV of filtered
rows. Manual entry via POST `/api/results` (faculty scoped to own
test + student batch).

Attendance: `/admin/attendance` — overview from
`/api/attendance/overview`. Dynamic date, honest empty state. Sync
button refreshes from register. K90 label: "NOT CONNECTED".

## 10. Books/storage

`/admin/books` — cover/PDF upload to Supabase via signed URLs. Delete
cleans storage first (fail-closed 502 if storage fails). No service key
leaves server.

## 11. Notifications + announcements

Phase 15 system retained. Admin history: `/api/notifications` +
`/api/notifications/mine` (per-user read receipts via `NotificationRead`
migration `20261007000000_notification_reads`). Broadcast reads: one
receipt per reader; shared flag flips only for individual rows.

Announcements/website content: `/api/announcements` (ticker). Publish/
schedule, audience targeting.

## 12. Website content

Banners/popups/gallery/testimonials/courses/faculty/results/announcements
all persist via their APIs. Toggle/move/reorder via PATCH — no local
writes on failure. Errors surface honestly.

Active/inactive filter for public routes (isActive + date window).
Admin sees full catalogue; public sees active/in-window only.

Advertisements page + settings page flagged "Demo only — edits here
never reach the database".

## 13. Biometric devices

`/admin/biometric-devices` + `/admin/biometric-device/[id]` — CRUD.
PATCH validates IP/port/protocol (400 on invalid, no silent drop).
DELETE: `select: DEVICE_SELECT` (no secret leak). FK fallback:
deactivate on dependency.

K90 label: "NOT YET CONNECTED / NOT CAPTURED" — no speculative claims.

## 14. Admin analytics

Dashboard stats from `/api/dashboard/stats` (bounded counts, no N+1).
No invented metrics. Honest empty states.

## 15. Destructive action safety

All DELETE endpoints: dependency pre-checks → 409 with guidance.
Students: results/attendance/attempts/grants → 409.
Faculty: batches → 409.
Batches: students/tests/attendance → 409.
Courses: batches/students/enquiries → 409.
Tests: attempts/results/grants → 409.

Never silent orphan. Prefer deactivate/COMPLETED.

## 16. Security tests

`npm run admin:check` — 114 checks:
- 1-4: role gates (anon/student/faculty/admin)
- 5: requireApiRole on 30+ endpoints
- 6: 409 dependency checks
- 7: faculty test/question scope
- 8: results student-batch check
- 9: public content isActive filter
- 10: biometric secret safety
- 11: no hash leaks
- 12: no localStorage authority
- 13: dashboard live stats
- 14: server auth on all admin pages
- 15: notifications honest
- 16: PATCH persistence for toggles/moves
- 17: admin profile server session
- 18: no client-trusted role/id

All pass (114/114).

## 17. Database / migration safety

No schema changes required for Phase 17 (Phase 16 added
`NotificationRead` migration `20261007000000_notification_reads` —
pending production `migrate deploy`, code degrades gracefully).

No `db push`, no `migrate reset`, no destructive migrations.

## 18. Performance

Dashboard/analytics: parallel aggregates with `select`, bounded `take`.
Lists: client pagination (20), search/filter memoized. No N+1.

## 19. Known limitations

1. Marks/analytics truncate at `take: 300/500` — extreme histories
   skew averages; no cursor pagination.
2. Books per-row URL resolution (≤200) — no signing cache.
3. NotificationRead migration pending production deploy; code degrades
   gracefully (broadcasts stay unread).
4. Scholarship sees PAID locked metadata — by design.
5. No offline test-taking (server engine only).
6. No cursor pagination on results/marks/books.
7. K90/ADMS untouched — attendance `source` preserved.
8. Advertisements + settings pages remain demo-only.
9. Website faculty duplicate with admin faculty — website page is
   visibility toggle over real records; admin page is full CRUD.

## 20. Regression suite (all PASS)

- `npx prisma generate` ✓
- `npx prisma validate` ✓
- `npm run lint` ✓ (0 errors, 19 warnings)
- `npm run security:check` — 97/97
- `npm run runtime:check` — 36/36
- `npm run storage:check` — 48/48
- `npm run faculty:check` — 43/43
- `npm run notification:check` — 39/39
- `npm run student:check` — 74/74
- `npm run admin:check` — 114/114
- `npm run build` ✓

## 21. Git safety

Working tree: 40 modified files, 1 new script (`scripts/admin-auth-check.ts`),
`tsconfig.tsbuildinfo` (build artifact, uncommitted).
No `.env`, secrets, biometric logs, build artifacts staged.
Not committed, not pushed, not tagged.

---

Verdict: Admin module production-ready. All authorization, persistence,
and destructive-action guards verified. Migration deployment for
`NotificationRead` is the only remaining production action.