# Faculty Module Status — Phase 14

## Completed Features
- Faculty navigation shell (`FacultyShell`) with desktop + mobile nav, unread notification badge, logout
- Faculty dashboard: assigned batches, upcoming tests, attendance overview, recent activity, notifications, quick actions
- Faculty profile: read-only account fields (facultyId, email, subject, status, batches) + editable name/phone/qualification/experience/bio
- Assigned batches list + batch detail (students preview, attendance/students/tests shortcuts, 403/404 on unassigned)
- Faculty student view: search + batch filter, attendance %, tests taken, avg score; minimal role-appropriate fields only
- Attendance workflow: batch + date picker, PRESENT/ABSENT/LATE/LEAVE marking, history via existing records, MANUAL source, biometric-record protection (409 on overwrite attempt)
- Test management: list created + assigned-batch tests; create DRAFT tests for assigned batches (FREE only; access type/price remain admin-controlled)
- Results dashboard: per-test filter, count/avg/high/low summary, server-calculated scores only
- Analytics: per-student attendance %, tests taken, avg score; overall aggregates; needs-attention list (attendance < 75% or avg < 40%)
- Notifications center: unread count, mark read, mark all read (reuses `/api/notifications/mine`)
- Middleware: all `/faculty/*` app routes require FACULTY or ADMIN; public login/register/profile-slug preserved

## API Routes
Reused (no change except attendance hardening + faculty/me PATCH):
- `GET /api/batches?facultyId=` — assigned batches (existing)
- `GET /api/tests` — FACULTY scope: created + assigned batches (existing)
- `GET /api/results` — FACULTY scope: own/assigned-batch tests (existing)
- `GET /api/attendance` — FACULTY scope added: unassigned batchId → 403; no batchId → scoped to assigned batches
- `POST /api/attendance` — FACULTY hardened: batch must be assigned, student must be in assigned batch, BIOMETRIC records cannot be overwritten (409)
- `GET/PATCH /api/notifications/mine` — FACULTY feed (existing)
- `GET /api/faculty/me` — own profile (existing)

New (faculty-scoped):
- `GET /api/faculty/dashboard` — batch/student counts, upcoming tests, pending evaluations, attendance rate
- `GET /api/faculty/batches` — assigned batches with student counts
- `GET /api/faculty/students?search=&batchId=` — students in assigned batches only (403 on unassigned batchId)
- `GET /api/faculty/activity` — recent attendance/test/result activity
- `GET /api/faculty/analytics` — per-student + overall aggregates
- `PATCH /api/faculty/me` — own profile edit (name/phone/qualification/experience/bio only)

## Authorization Model
- Session/HMAC cookie via `getUserFromRequest`; API guard `requireApiRole(req, ["FACULTY"])` (or `["FACULTY","ADMIN"]` where admin visibility intended)
- Never trust facultyId from body; always derive from session (`auth.user.id` → `facultyBatchIds`)
- Batch scoping on every faculty query via `facultyBatchIds(db, userId)` (Batch.facultyId → Faculty.userId)
- Unassigned resource access → 403 (explicit) or 404 (avoid leakage on detail pages)
- Admin APIs remain ADMIN-only; faculty cannot hit them (403)

## Faculty Permissions
- CAN: view own profile + assigned batches/students; mark MANUAL attendance for assigned-batch students; create DRAFT/FREE tests for assigned batches; view results for own/assigned-batch tests; view analytics for assigned students; read/mark own notifications; edit own name/phone/qualification/experience/bio
- CANNOT: access admin endpoints; modify another faculty's profile; see unrelated students/batches; modify student accounts; change role/status/batch assignment; publish tests or set access type/price; change test ownership; submit forged scores; read answer keys outside authorized tests; overwrite BIOMETRIC attendance

## Attendance Behavior
- Faculty manual marks use `source = MANUAL` always
- Existing BIOMETRIC record for same student/date → 409, preserved, admin contact required
- Respects `@@unique([studentId, date])` via upsert
- Faculty POST validates batch assignment + student batch membership

## Test Permissions
- List: created-by-me OR assigned-batch tests (existing `GET /api/tests` FACULTY scope)
- Create: DRAFT + FREE + assigned-batch only; accessType/price rejected for faculty (403)
- Publishing, access grants, pricing: admin-only (documented, not implemented for faculty)

## Result Permissions
- Read: own/assigned-batch tests only (existing `GET /api/results` FACULTY scope)
- Offline marks: existing `/api/results/offline` + `OfflineMarksForm` reused on dashboard
- Scores server-authoritative; no client score/percentage accepted for online evaluation

## Notification Behavior
- Reuses `/api/notifications/mine` (FACULTY scope: own + FACULTY audience + assigned-batch targets)
- Unread badge in FacultyShell; mark read / mark all read

## Database Changes
- **None in Phase 14.** No schema/migration changes.
- Restored `prisma/schema.prisma` from truncated 92-line state to full production schema (605-line baseline) + existing biometric models (BiometricDevice, BiometricDeviceEvent). No new models, no migration. `prisma validate` passes.

## Known Limitations
- No persistent BiometricUserMap table (deferred to post-capture schema phase)
- Device ingestion authentication remains DEVICE_AUTH_GAP (no protocol change in this phase)
- Faculty cannot publish tests, manage access grants, or evaluate subjective answers (schema/workflow gaps documented, not faked)
- `app/services/adminApi.ts` (Phase 12B duplicate, wrong location) is dead code; biometric admin pages now use fetch-based calls
- Pre-existing lint/type debt in unrelated files (admin website `any`, gallery `imageUrl`, biometric delegates vs stale `@prisma/client` types) — untouched except build-blocking syntax/import fixes

## Future Improvements
- BiometricUserMap migration + mapping APIs (post-capture)
- ADMS listener (VPS:8787) + protocol parser + device auth (post-capture)
- Faculty test question editor + preview + attempt review UI
- Faculty attendance history filters + export
- Push notifications (web-push provider)
