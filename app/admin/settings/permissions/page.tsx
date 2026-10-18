"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2, XCircle, Shield, Key, Globe, Users, GraduationCap, Layers, FileText, Bell, Inbox, Settings, Save, Loader2, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { cn } from "@/lib/utils";

interface PermissionRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  scope: string;
  isActive: boolean;
  createdAt: string;
  roles: Array<{ role: string; scopeValue: string | null }>;
}

interface RolePermissionRow {
  role: string;
  permissionId: string;
  permission: { key: string; name: string; resource: string; action: string; scope: string };
  scopeValue: string | null;
}

const SCOPE_LABELS: Record<string, string> = {
  GLOBAL: "Global",
  BRANCH: "Branch",
  BATCH: "Batch",
  COURSE: "Course",
};

const SCOPE_ICONS: Record<string, any> = {
  GLOBAL: Globe,
  BRANCH: Users,
  BATCH: Layers,
  COURSE: GraduationCap,
};

const RESOURCE_GROUPS = [
  { key: "students", label: "Students", icon: Users },
  { key: "tests", label: "Tests", icon: FileText },
  { key: "questions", label: "Questions", icon: FileText },
  { key: "batches", label: "Batches", icon: Layers },
  { key: "faculty", label: "Faculty", icon: GraduationCap },
  { key: "courses", label: "Courses", icon: GraduationCap },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "enquiries", label: "Enquiries", icon: Inbox },
  { key: "books", label: "Books", icon: FileText },
  { key: "attendance", label: "Attendance", icon: FileText },
  { key: "biometric", label: "Biometric Devices", icon: Shield },
  { key: "website", label: "Website CMS", icon: Globe },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "audit", label: "Audit Logs", icon: Key },
  { key: "permissions", label: "Permissions", icon: Shield },
  { key: "bulk", label: "Bulk Operations", icon: Shield },
];

const ACTIONS = ["create", "read", "update", "delete", "bulk_create", "bulk_update", "bulk_delete", "status_change", "permission_grant", "permission_revoke", "export", "import"];

function ScopeBadge({ scope }: { scope: string }) {
  const Icon = SCOPE_ICONS[scope] || Globe;
  return (
    <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-widest bg-silver-100 text-silver-700">
      <Icon className="h-3 w-3" /> {SCOPE_LABELS[scope] || scope}
    </span>
  );
}

function RoleBadge({ role, scopeValue }: { role: string; scopeValue: string | null }) {
  const colors: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    FACULTY: "bg-blue-100 text-blue-800",
    STUDENT: "bg-teal-100 text-teal-800",
  };
  return (
    <span className={cn("rounded-full px-2 py-1 text-[10px] font-extrabold", colors[role] || "bg-silver-100 text-silver-800")}>
      {role} {scopeValue ? `(${scopeValue})` : ""}
    </span>
  );
}

export default function PermissionsPage() {
  const ready = useAdminGuard();
  const router = useRouter();
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "assign" | "revoke">("create");
  const [editingPermission, setEditingPermission] = useState<PermissionRow | null>(null);
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [selectedScope, setSelectedScope] = useState("GLOBAL");
  const [selectedScopeValue, setSelectedScopeValue] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newResource, setNewResource] = useState("");
  const [newAction, setNewAction] = useState("");
  const [newScope, setNewScope] = useState("GLOBAL");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    loadPermissions();
    loadRolePermissions();
  }, [ready]);

  async function loadPermissions() {
    try {
      const res = await fetch("/api/admin/permissions", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items)) {
        setPermissions(json.data.items);
      }
    } catch {
      setError("Failed to load permissions");
    }
  }

  async function loadRolePermissions() {
    try {
      const res = await fetch("/api/admin/permissions/roles", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items)) {
        setRolePermissions(json.data.items);
      }
    } catch {
      setError("Failed to load role permissions");
    }
  }

  const groupedPermissions = RESOURCE_GROUPS.map((group) => ({
    ...group,
    permissions: permissions.filter((p) => p.resource === group.key),
  })).filter((g) => g.permissions.length > 0);

  function openCreateModal() {
    setModalMode("create");
    setEditingPermission(null);
    setNewKey("");
    setNewName("");
    setNewDescription("");
    setNewResource("");
    setNewAction("");
    setNewScope("GLOBAL");
    setError(null);
    setModalOpen(true);
  }

  function openAssignModal() {
    setModalMode("assign");
    setSelectedRole("ADMIN");
    setSelectedScope("GLOBAL");
    setSelectedScopeValue("");
    setError(null);
    setModalOpen(true);
  }

  function openRevokeModal(rp: RolePermissionRow) {
    setModalMode("revoke");
    setEditingPermission(rp.permission as any);
    setSelectedRole(rp.role);
    setSelectedScopeValue(rp.scopeValue || "");
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingPermission(null);
    setError(null);
  }

  async function submitCreate() {
    if (!newKey || !newName || !newResource || !newAction || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey,
          name: newName,
          description: newDescription,
          resource: newResource,
          action: newAction,
          scope: newScope,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Create failed");

      setSuccess("Permission created");
      closeModal();
      loadPermissions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitAssign() {
    if (!editingPermission || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/permissions/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          permissionId: editingPermission.id,
          scope: selectedScope,
          scopeValue: selectedScopeValue || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Assign failed");

      setSuccess(`Permission assigned to ${selectedRole}`);
      closeModal();
      loadRolePermissions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitRevoke() {
    if (!editingPermission || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/permissions/roles/${editingPermission.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          scopeValue: selectedScopeValue || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Revoke failed");

      setSuccess(`Permission revoked from ${selectedRole}`);
      closeModal();
      loadRolePermissions();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <AdminLayout title="Permissions" subtitle="Settings → Permissions">
        <LoadingState message="Loading…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Permissions" subtitle="Granular RBAC for admin roles">
      <AdminPageHeader
        title="Permission Management"
        description="Define granular permissions and assign them to roles with scope. ADMIN role has all permissions by default."
        actionLabel="Create Permission"
        actionIcon={Plus}
        onAction={openCreateModal}
      />

      {success && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson">{error}</p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={openAssignModal} variant="outline">
          <Key className="h-4 w-4 mr-2" /> Assign to Role
        </Button>
        <Button onClick={loadPermissions} disabled={loading} variant="outline">
          <Loader2 className={cn("h-4 w-4 mr-2", loading ? "animate-spin" : "")} /> Refresh
        </Button>
      </div>

      {groupedPermissions.length === 0 ? (
        <EmptyState title="No permissions defined" desc="Create permissions for each resource/action combination." />
      ) : (
        <div className="space-y-6">
          {groupedPermissions.map((group) => (
            <div key={group.key} className="rounded-card border border-silver-200 bg-white shadow-card">
              <div className="border-b border-silver-200 px-5 py-3 bg-silver-50">
                <div className="flex items-center gap-2">
                  <group.icon className="h-5 w-5 text-navy-700" />
                  <h3 className="text-lg font-extrabold text-navy-700">{group.label}</h3>
                </div>
              </div>
              <div className="p-5">
                <AdminTable<PermissionRow>
                  columns={[
                    { key: "key", header: "Key", render: (p) => <code className="text-[12px] font-mono text-navy-700 bg-silver-50 px-2 py-1 rounded">{p.key}</code> },
                    { key: "name", header: "Name", render: (p) => <span className="font-bold text-navy-700">{p.name}</span> },
                    { key: "desc", header: "Description", render: (p) => <span className="text-[12px] text-muted max-w-xs truncate block">{p.description || "—"}</span> },
                    { key: "action", header: "Action", render: (p) => (
                      <span className="rounded-full px-2 py-1 text-[10px] font-extrabold bg-teal-50 text-teal-700">{p.action.toUpperCase()}</span>
                    )},
                    { key: "scope", header: "Scope", render: (p) => <ScopeBadge scope={p.scope} /> },
                    { key: "status", header: "Status", render: (p) => {
                      const isActive = p.isActive;
                      return <AdminStatusBadge tone={isActive ? "green" : "gray"}>{isActive ? "Active" : "Inactive"}</AdminStatusBadge>;
                    } },
                    { key: "roles", header: "Assigned Roles", render: (p) => (
                      <div className="flex flex-wrap gap-1">
                        {p.roles.map((r) => <RoleBadge key={`${r.role}-${r.scopeValue}`} role={r.role} scopeValue={r.scopeValue} />)}
                        {p.roles.length === 0 && <span className="text-[11px] text-muted">None</span>}
                      </div>
                    )},
                    { key: "actions", header: "Actions", className: "text-right", render: (p) => (
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => { setEditingPermission(p); openAssignModal(); }}
                          className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500"
                          title="Assign to role"
                        >
                          <Key className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setEditingPermission(p); openRevokeModal(p as any); }}
                          className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50"
                          title="Revoke from role"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete permission ${p.key}?`)) return;
                            try {
                              await fetch(`/api/admin/permissions/${p.id}`, { method: "DELETE" });
                              loadPermissions();
                            } catch { /* ignore */ }
                          }}
                          className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50"
                          title="Delete permission"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )},
                  ]}
                  rows={group.permissions}
                />
              </div>
            </div>
          ))}

          {/* Unassigned permissions */}
          <div className="rounded-card border border-silver-200 bg-white shadow-card">
            <div className="border-b border-silver-200 px-5 py-3 bg-silver-50">
              <h3 className="text-lg font-extrabold text-navy-700">All Permissions Matrix</h3>
            </div>
            <div className="p-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-silver-500">
                    <th className="p-3 text-left">Permission</th>
                    <th className="p-3 text-left">Resource</th>
                    <th className="p-3 text-left">Action</th>
                    <th className="p-3 text-left">Scope</th>
                    <th className="p-3 text-left">ADMIN</th>
                    <th className="p-3 text-left">FACULTY</th>
                    <th className="p-3 text-left">STUDENT</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p) => (
                    <tr key={p.id} className="border-b border-silver-100">
                      <td className="p-3 font-mono text-[11px] text-navy-700">{p.key}</td>
                      <td className="p-3 text-navy-700">{p.resource}</td>
                      <td className="p-3"><span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-teal-50 text-teal-700">{p.action}</span></td>
                      <td className="p-3"><ScopeBadge scope={p.scope} /></td>
                      <td className="p-3">
                        {rolePermissions.some(rp => rp.permissionId === p.id && rp.role === "ADMIN") ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                        ) : <span className="text-silver-300">—</span>}
                      </td>
                      <td className="p-3">
                        {rolePermissions.some(rp => rp.permissionId === p.id && rp.role === "FACULTY") ? (
                          <CheckCircle2 className="h-4 w-4 text-blue-600 mx-auto" />
                        ) : <span className="text-silver-300">—</span>}
                      </td>
                      <td className="p-3">
                        {rolePermissions.some(rp => rp.permissionId === p.id && rp.role === "STUDENT") ? (
                          <CheckCircle2 className="h-4 w-4 text-teal-600 mx-auto" />
                        ) : <span className="text-silver-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <AdminModal open={modalOpen} title={
        modalMode === "create" ? "Create Permission" :
        modalMode === "assign" ? "Assign Permission to Role" :
        "Revoke Permission from Role"
      } onClose={closeModal} wide>
        {modalMode === "create" && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-[12px] font-bold text-navy-700">
                Key *
                <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="students:create" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" required />
              </label>
              <label className="block text-[12px] font-bold text-navy-700">
                Name *
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Create Students" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" required />
              </label>
            </div>
            <label className="block text-[12px] font-bold text-navy-700">
              Description
              <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={2} placeholder="Allow creating new student records" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-[12px] font-bold text-navy-700">
                Resource *
                <select value={newResource} onChange={(e) => setNewResource(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" required>
                  <option value="">Select resource</option>
                  {RESOURCE_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-bold text-navy-700">
                Action *
                <select value={newAction} onChange={(e) => setNewAction(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" required>
                  <option value="">Select action</option>
                  {ACTIONS.map((a) => <option key={a} value={a}>{a.replace("_", " ").toUpperCase()}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-[12px] font-bold text-navy-700">
                Scope *
                <select value={newScope} onChange={(e) => setNewScope(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" required>
                  <option value="GLOBAL">Global</option>
                  <option value="BRANCH">Branch</option>
                  <option value="BATCH">Batch</option>
                  <option value="COURSE">Course</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {modalMode === "assign" && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-[12px] font-bold text-navy-700">
                Permission *
                <select value={editingPermission?.id || ""} onChange={(e) => setEditingPermission(permissions.find(p => p.id === e.target.value) || null)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" required>
                  <option value="">Select permission</option>
                  {permissions.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}
                </select>
              </label>
              <label className="block text-[12px] font-bold text-navy-700">
                Role *
                <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" required>
                  <option value="ADMIN">Admin</option>
                  <option value="FACULTY">Faculty</option>
                  <option value="STUDENT">Student</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-[12px] font-bold text-navy-700">
                Scope *
                <select value={selectedScope} onChange={(e) => setSelectedScope(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" required>
                  <option value="GLOBAL">Global</option>
                  <option value="BRANCH">Branch</option>
                  <option value="BATCH">Batch</option>
                  <option value="COURSE">Course</option>
                </select>
              </label>
              <label className="block text-[12px] font-bold text-navy-700">
                Scope Value (optional)
                <input value={selectedScopeValue} onChange={(e) => setSelectedScopeValue(e.target.value)} placeholder="e.g., batch-id or course-id" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
              </label>
            </div>
            <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-bold text-amber-800">
              GLOBAL scope applies to all resources. BRANCH/BATCH/COURSE scopes restrict to specific entities.
            </p>
          </div>
        )}

        {modalMode === "revoke" && editingPermission && (
          <div className="space-y-3">
            <p className="text-sm text-navy-700">Revoke <b>{editingPermission.key}</b> from <b>{selectedRole}</b>?</p>
            <p className="text-[12px] text-muted">This will remove the permission assignment. The permission definition will remain.</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-[12px] font-bold text-navy-700">
                Scope Value
                <input value={selectedScopeValue} onChange={(e) => setSelectedScopeValue(e.target.value)} placeholder="Must match the assigned scope value" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
              </label>
            </div>
            <p className="rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[12px] font-bold text-crimson">This action cannot be undone. Re-assign if needed.</p>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={closeModal}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={
            modalMode === "create" ? submitCreate :
            modalMode === "assign" ? submitAssign :
            submitRevoke
          } disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {modalMode === "create" ? "Create" : modalMode === "assign" ? "Assign" : "Revoke"}
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}