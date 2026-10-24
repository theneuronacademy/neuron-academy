// Permissions admin UI removed. This route stays navigable (old bookmarks,
// cached links) and forwards to the admin settings page.
// The underlying permission model, role checks and APIs are untouched:
// access is still enforced by middleware.ts, server sessions and
// requireApiRole() guards in app/api/**.
import { redirect } from "next/navigation";

export default function PermissionsRedirectPage() {
  redirect("/admin/settings");
}
