"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, UserPlus, CheckCircle2, XCircle, Loader2, Filter, ArrowLeft } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminStatusBadge, statusToneFor } from "@/components/admin/AdminStatusBadge";
import { AdminModal } from "@/components/admin/AdminModal";
import { LoadingState, EmptyState } from "@/components/admin/AdminStates";
import { Button } from "@/components/ui/primitives";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { cn } from "@/lib/utils";

interface TestRow {
  id: string;
  title: string;
  type: string;
  accessType: string;
  price: number;
  status: string;
  batch?: { name: string } | null;
}

interface StudentRow {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  batch: string;
  studentType: string;
  status: string;
}

interface GrantRow {
  id: string;
  testId: string;
  testTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  grantedBy: string;
  status: string;
  grantedAt: string;
  expiresAt: string | null;
  paymentRef?: string;
  amount?: number;
}

const ACCESS_TYPE_LABELS: Record<string, string> = {
  FREE: "Free",
  PAID: "Paid",
  PRIVATE: "Private",
};

const GRANT_STATUS_TONES: Record<string, "green" | "red" | "blue" | "gray" | "amber"> = {
  ACTIVE: "green",
  REVOKED: "red",
  EXPIRED: "gray",
  PENDING_PAYMENT: "amber",
};

function AccessTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    FREE: "bg-teal-100 text-teal-800",
    PAID: "bg-amber-100 text-amber-800",
    PRIVATE: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-widest", colors[type] || "bg-silver-100 text-silver-800")}>
      {ACCESS_TYPE_LABELS[type] || type}
    </span>
  );
}

function GrantStatusBadge({ status }: { status: string }) {
  const tone = GRANT_STATUS_TONES[status] || "gray";
  const labels: Record<string, string> = {
    ACTIVE: "Active",
    REVOKED: "Revoked",
    EXPIRED: "Expired",
    PENDING_PAYMENT: "Pending Payment",
  };
  return <AdminStatusBadge tone={tone}>{labels[status] || status}</AdminStatusBadge>;
}

export default function GrantAccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted">Loading...</div>}>
      <GrantAccessPageContent />
    </Suspense>
  );
}

function GrantAccessPageContent() {
  const ready = useAdminGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedTestId = searchParams.get("testId");
  const preSelectedStudentId = searchParams.get("studentId");

  const [tests, setTests] = useState<TestRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [search, setSearch] = useState("");
  const [testFilter, setTestFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"grant" | "revoke" | "extend">("grant");
  const [selectedTest, setSelectedTest] = useState<TestRow | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [selectedGrant, setSelectedGrant] = useState<GrantRow | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    loadTests();
    loadStudents();
    loadGrants();

    if (preSelectedTestId) setTestFilter(preSelectedTestId);
  }, [ready]);

  async function loadTests() {
    try {
      const res = await fetch("/api/tests?limit=200", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items)) {
        setTests(json.data.items.filter((t: TestRow) => t.accessType !== "FREE"));
      }
    } catch {
      setError("Failed to load tests");
    }
  }

  async function loadStudents() {
    try {
      const res = await fetch("/api/students?limit=500", { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items)) {
        setStudents(json.data.items.filter((s: StudentRow) => s.status === "active"));
      }
    } catch {
      setError("Failed to load students");
    }
  }

  async function loadGrants() {
    try {
      const params = new URLSearchParams();
      if (testFilter !== "all") params.set("testId", testFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/test-access/grants?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.items)) {
        setGrants(json.data.items);
      }
    } catch {
      setError("Failed to load grants");
    }
  }

  const filteredStudents = students.filter(
    (s) =>
      !search.trim() ||
      `${s.name} ${s.studentId} ${s.email} ${s.phone}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGrants = grants.filter((g) =>
    !search.trim() || `${g.testTitle} ${g.studentName} ${g.studentEmail}`.toLowerCase().includes(search.toLowerCase())
  );

  function openGrantModal(test?: TestRow, student?: StudentRow) {
    if (test) setSelectedTest(test);
    if (student) setSelectedStudent(student);
    setModalMode("grant");
    setExpiresAt("");
    setPaymentRef("");
    setAmount("");
    setError(null);
    setModalOpen(true);
  }

  function openRevokeModal(grant: GrantRow) {
    setSelectedGrant(grant);
    setModalMode("revoke");
    setModalOpen(true);
  }

  function openExtendModal(grant: GrantRow) {
    setSelectedGrant(grant);
    setModalMode("extend");
    setExpiresAt(grant.expiresAt ? new Date(grant.expiresAt).toISOString().slice(0, 16) : "");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedTest(null);
    setSelectedStudent(null);
    setSelectedGrant(null);
  }

  async function submitGrant() {
    if (!selectedTest || !selectedStudent || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/test-access/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: selectedTest.id,
          studentId: selectedStudent.id,
          expiresAt: expiresAt || null,
          paymentRef: paymentRef.trim() || null,
          amount: amount ? parseFloat(amount) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Grant failed");

      setSuccess(`Access granted for ${selectedStudent.name} to ${selectedTest.title}`);
      closeModal();
      loadGrants();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grant failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitRevoke() {
    if (!selectedGrant || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/test-access/grants/${selectedGrant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVOKED" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Revoke failed");

      setSuccess(`Access revoked for ${selectedGrant.studentName}`);
      closeModal();
      loadGrants();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitExtend() {
    if (!selectedGrant || !expiresAt || busy) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/test-access/grants/${selectedGrant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresAt: new Date(expiresAt).toISOString() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Extend failed");

      setSuccess(`Access extended for ${selectedGrant.studentName} until ${new Date(expiresAt).toLocaleString()}`);
      closeModal();
      loadGrants();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extend failed");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <AdminLayout title="Test Access Grants" subtitle="Manage PAID/PRIVATE test access">
        <LoadingState message="Loading…" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Test Access Grants" subtitle="Grant, revoke, and extend PAID/PRIVATE test access">
      <AdminPageHeader
        title="Test Access Management"
        description="Manage student access to PAID and PRIVATE tests. Grants are created after confirming external UPI payment."
        actionLabel="Grant Access"
        actionIcon={UserPlus}
        onAction={() => openGrantModal()}
      />

      {success && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-crimson-200 bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson">{error}</p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search grants, students, tests…"
            className="bg-transparent outline-none w-64"
          />
        </label>
        <select
          value={testFilter}
          onChange={(e) => { setTestFilter(e.target.value); loadGrants(); }}
          className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All Tests</option>
          {tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); loadGrants(); }}
          className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="REVOKED">Revoked</option>
          <option value="EXPIRED">Expired</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
        </select>
        <Button onClick={loadGrants} disabled={loading} className="ml-auto">
          <Loader2 className={cn("h-4 w-4", loading ? "animate-spin" : "")} /> Refresh
        </Button>
      </div>

      {filteredGrants.length === 0 ? (
        <EmptyState title="No grants found" desc="Create grants for PAID/PRIVATE tests after confirming payment." />
      ) : (
        <AdminTable<GrantRow>
          columns={[
            { key: "test", header: "Test", render: (g) => <span className="font-extrabold text-navy-700">{g.testTitle}</span> },
            { key: "type", header: "Type", render: (g) => <AccessTypeBadge type={tests.find(t => t.id === g.testId)?.accessType || "FREE"} /> },
            { key: "student", header: "Student", render: (g) => (
              <div>
                <p className="font-extrabold text-navy-700">{g.studentName}</p>
                <p className="text-[12px] text-muted">{g.studentEmail} • {tests.find(t => t.id === g.testId)?.batch?.name || "Open"}</p>
              </div>
            )},
            { key: "granted", header: "Granted", render: (g) => <span className="text-[13px] text-muted">{new Date(g.grantedAt).toLocaleString()}</span> },
            { key: "expires", header: "Expires", render: (g) => g.expiresAt ? (
              <span className={cn("text-[13px] font-bold", new Date(g.expiresAt) < new Date() ? "text-crimson" : "text-teal-700")}>
                {new Date(g.expiresAt).toLocaleString()}
              </span>
            ) : <span className="text-[13px] text-teal-700">Never</span> },
            { key: "payment", header: "Payment", render: (g) => (
              <div className="text-[12px] text-muted">
                {g.paymentRef ? <p className="font-bold">Ref: {g.paymentRef}</p> : <p>—</p>}
                {g.amount ? <p>₹{g.amount}</p> : null}
              </div>
            )},
            { key: "status", header: "Status", render: (g) => <GrantStatusBadge status={g.status} /> },
            { key: "actions", header: "Actions", className: "text-right", render: (g) => (
              <div className="flex justify-end gap-1.5">
                {g.status === "ACTIVE" && (
                  <>
                    <button onClick={() => openExtendModal(g)} className="rounded-lg border border-silver-300 p-2 text-navy-700 hover:border-teal-500" title="Extend">
                      <Filter className="h-4 w-4" />
                    </button>
                    <button onClick={() => openRevokeModal(g)} className="rounded-lg border border-crimson-100 p-2 text-crimson hover:bg-crimson-50" title="Revoke">
                      <XCircle className="h-4 w-4" />
                    </button>
                  </>
                )}
                {g.status === "EXPIRED" && (
                  <button onClick={() => openExtendModal(g)} className="rounded-lg border border-teal-100 p-2 text-teal-700 hover:bg-teal-50" title="Re-grant">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
              </div>
            )},
          ]}
          rows={filteredGrants}
        />
      )}

      <AdminModal open={modalOpen} title={modalMode === "grant" ? "Grant Test Access" : modalMode === "revoke" ? "Revoke Access" : "Extend Access"} onClose={closeModal} wide>
        {modalMode === "grant" && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-[12px] font-bold text-navy-700">
                Test *
                <select
                  value={selectedTest?.id || ""}
                  onChange={(e) => setSelectedTest(tests.find(t => t.id === e.target.value) || null)}
                  className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                  required
                >
                  <option value="">Select test</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({ACCESS_TYPE_LABELS[t.accessType]} • ₹{t.price}) {t.batch?.name ? `• ${t.batch.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-bold text-navy-700">
                Student *
                <select
                  value={selectedStudent?.id || ""}
                  onChange={(e) => setSelectedStudent(students.find(s => s.id === e.target.value) || null)}
                  className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                  required
                >
                  <option value="">Select student</option>
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.studentId}) • {s.batch}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-[12px] font-bold text-navy-700">
                Expires At (optional)
                <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
              </label>
              <label className="block text-[12px] font-bold text-navy-700">
                Payment Reference (UPI Txn ID)
                <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="UPI123456789" className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
              </label>
            </div>

            <label className="block text-[12px] font-bold text-navy-700">
              Amount Paid (₹)
              <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
            </label>

            <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-bold text-amber-800">
              Ensure payment is confirmed in your UPI app/bank before granting access. This action is audited.
            </p>
          </div>
        )}

        {modalMode === "revoke" && selectedGrant && (
          <div className="space-y-3">
            <p className="text-sm text-navy-700">Revoke access for <b>{selectedGrant.studentName}</b> to <b>{selectedGrant.testTitle}</b>?</p>
            <p className="text-[12px] text-muted">This will immediately prevent the student from accessing the test. The grant record will be kept for audit.</p>
            <p className="rounded-xl bg-crimson-50 px-3.5 py-2.5 text-[12px] font-bold text-crimson">This action cannot be undone. Use &ldquo;Extend&rdquo; to re-grant later.</p>
          </div>
        )}

        {modalMode === "extend" && selectedGrant && (
          <div className="space-y-3">
            <p className="text-sm text-navy-700">Extend access for <b>{selectedGrant.studentName}</b> to <b>{selectedGrant.testTitle}</b></p>
            <label className="block text-[12px] font-bold text-navy-700">
              New Expiry Date *
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2.5 text-sm outline-none focus:border-teal-500" required />
            </label>
            <p className="rounded-xl bg-teal-50 px-3.5 py-2.5 text-[12px] font-bold text-teal-800">A new grant will be created with the extended expiry. The previous grant will be marked REVOKED.</p>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={closeModal}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={
            modalMode === "grant" ? submitGrant :
            modalMode === "revoke" ? submitRevoke :
            submitExtend
          } disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {modalMode === "grant" ? "Grant Access" : modalMode === "revoke" ? "Revoke Access" : "Extend Access"}
          </Button>
        </div>
      </AdminModal>
    </AdminLayout>
  );
}