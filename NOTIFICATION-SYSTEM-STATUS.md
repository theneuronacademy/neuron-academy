# Notification System Status — Phase 15

## Notification Model
Prisma `Notification` (production, baseline migration — unchanged in this phase):
- Identity: `id`, `createdById` → User, `createdAt/updatedAt`
- Targeting: `targetStudentId` → Student, `targetBatchId` → Batch, `targetFacultyId` → Faculty, `targetUserId` → User, `audience` enum (`ALL_STUDENTS | BATCH | FACULTY | INDIVIDUAL`)
- Content: `title`, `message`, `type` (category string: `test | result | attendance | access | general`, …), `testId` (optional deep link)
- Delivery state: `channel` (`IN_APP | WEB_PUSH | MOBILE_PUSH`, default `IN_APP`), `status` (`DRAFT | SCHEDULED | SENT`), `sentAt/scheduledAt`, `isRead/readAt`
- Indexes: `targetStudentId`, `targetUserId`, `targetBatchId`, `status`, `channel`, `audience`, `createdAt`
- No secrets/OTPs/passwords/biometric data stored. No schema change in Phase 15.

## Targeting
| Scope | Mechanism |
|---|---|
| Individual student | `audience: INDIVIDUAL` + `targetStudentId` |
| Student batch | `audience: BATCH` + `targetBatchId` |
| All students | `audience: ALL_STUDENTS` |
| Faculty broadcast | `audience: FACULTY` |
| Individual faculty/user | `targetFacultyId` / `targetUserId` + `INDIVIDUAL` |
| Admin/system | `createdById` = acting admin; admin reads full history via ADMIN list |

Resolution order for students: own rows → own user rows → own batch rows → `ALL_STUDENTS`. Faculty: own user rows → `FACULTY` broadcasts → assigned-batch rows. Existing schema reused; no duplicate models.

## APIs
| Route | Auth | Purpose |
|---|---|---|
| `GET /api/notifications?limit=` | ADMIN | Broadcast history, newest first (default 100, max 200) |
| `POST /api/notifications` | ADMIN | Create (audience allowlist validated; `SENT` immediate or `SCHEDULED`) |
| `GET/PATCH/DELETE /api/notifications/[id]` | ADMIN | Read / edit title-message-status / delete |
| `GET /api/notifications/mine?limit=` | STUDENT/FACULTY (self) | Personal feed + `unreadCount` (default 50, max 100) |
| `PATCH /api/notifications/mine` | STUDENT/FACULTY (self) | Mark one (`{id}`) or all (`{all:true}`) read — strictly own visible set |
| `GET /api/push/subscribe` | public (safe) | Returns VAPID **public** key only, or honest 503 |
| `POST/DELETE /api/push/subscribe` | authenticated (self) | Store/remove **caller's own** subscription |

## Authorization
- Student/faculty feeds derive identity from the session (`viewer.id`/`viewer.email` → `resolveStudent` / `facultyBatchIds`); client-supplied recipient IDs are never trusted (no `body.userId`/`body.studentId` in mine/PATCH/subscribe paths — verified by `notification-check`).
- Mark-read single/all `where` clauses always include the viewer's own visibility scope; foreign IDs yield 404, cross-role access 403, anonymous 401.
- Admin create/update/delete remain ADMIN-only. Detail route ADMIN-only (full row incl. targeting IDs never leaves admin boundary).
- Feed `shape()` exposes only `id/title/message/type/testId/isRead/createdAt`.

## Automatic Triggers (all via central `safeNotify`, never throws)
| Event | Rule | Dedup |
|---|---|---|
| Test access granted | `INDIVIDUAL` → student | Grant route 409s duplicate active grants |
| Test access revoked | `INDIVIDUAL` → student | Status transition only |
| Test published (FREE only) | `BATCH` or `ALL_STUDENTS` | **NEW:** only on transition into PUBLISHED (re-publish silent); PAID/PRIVATE never broadcast |
| Result released | `INDIVIDUAL` → student | **NEW:** only on first release (re-submit/re-eval silent) |
| Attendance ABSENT | `INDIVIDUAL` → student | **NEW:** one alert per student per day (same-day `attendance`-type check); PRESENT/LATE/LEAVE stay silent |
| Admin announcement | audience selected in admin console | Manual action (no auto-fire) |

## Web Notification Behavior
- Database row is authoritative. Badge counts come from `unreadCount` (unbounded count + bounded list).
- Refresh: on-mount + route-change fetch (`limit=1` for badges, `limit=50` for lists). No aggressive polling; no realtime infra exists (documented, not introduced).
- Read state persists server-side (`isRead/readAt`); student page keeps localStorage **fallback only** when the API is unreachable (never authoritative).

## Push Status — FOUNDATION (not live delivery)
- `PushSubscription` model + `services/webPush.ts` (`subscribe`/`unsubscribe`) + `/api/push/subscribe` (session-bound) — all working.
- `sendNotification` is an honest stub: `WEB_PUSH_NOT_CONFIGURED` without VAPID keys, `WEB_PUSH_PROVIDER_MISSING` otherwise. **Delivery is never claimed.**
- Invalid-subscription cleanup is pending on a real provider (410/404 handling); documented, not faked.

## VAPID Configuration
- `VAPID_PUBLIC_KEY` (browser-safe, served by `GET /api/push/subscribe`), `VAPID_PRIVATE_KEY` (**server-only**, never in responses/logs/client), `VAPID_SUBJECT`.
- Absent keys → push endpoints return honest 503 / `WEB_PUSH_NOT_CONFIGURED`; web notifications unaffected.

## MSG91 Boundary
- `services/msg91.ts` + `lib/otp.ts`: **OTP/authentication domain only** (registration/login verification). Peppered-hash storage, honest `MSG91_NOT_CONFIGURED`, DLT template + sender required.
- Application notifications **never** send SMS and never share OTP logic. Boundary documented here; no cross-calls exist.

## Pagination / Retention
- `mine`: `?limit=` default 50, clamp 1–100. Admin list: default 100, clamp 1–200 (preserves prior ceiling). Newest-first everywhere.
- No retention deletion exists or was added; history is preserved. Cursor pagination is a future improvement (documented).

## Deduplication
- Grant 409 (no double grants → no double `accessGranted`).
- Publish transition gate (`previous.status !== PUBLISHED`).
- First-release gate (`!existing` result).
- Absence same-day gate (one `attendance`-type row per student/day).
- No blanket unique constraint (legitimate repeats, e.g. distinct announcements, must remain possible).

## Known Limitations
1. No realtime transport (polling-on-navigate only).
2. No cursor pagination (limit-based lists).
3. Push delivery provider not installed (`web-push` package + VAPID signing + round-trip test pending).
4. `services/notificationService.ts` (localStorage helpers) is legacy dead code — left untouched, superseded by `lib/notify.ts` + DB APIs.
5. `targetFacultyId` has no dedicated index (no current query filters on it; faculty feed uses `targetUserId` + audience + batch).
6. Attendance alerts cover ABSENT only by anti-spam design.

## Production Configuration Steps
1. Set `DATABASE_URL` (Supabase) — notifications are DB-backed; demo fallbacks are read-only.
2. Set `SESSION_SECRET` (≥16 chars) — otherwise feeds fail closed (503/401).
3. Optional push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` + install `web-push` provider + test round-trip before claiming delivery.
4. Optional SMS/OTP: `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_SENDER_ID` + approved DLT template (OTP only, unrelated to notifications).
5. Never commit `.env` or keys; verify with `npm run notification:check`.
