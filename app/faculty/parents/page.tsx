// Faculty Parents Page - 1:1 parent communication
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, MessageSquare, FileText, Users, Search, Download, Plus } from "lucide-react";
import { FacultyShell } from "@/components/faculty/FacultyShell";
import { useFacultyBatches, useFacultyStudents, useParentMessages, useSendParentMessage, useSendBulkParentReport } from "@/lib/faculty-hooks";
import type { StudentRow } from "@/types/faculty";
import { cn } from "@/lib/utils";

const CHANNELS = ["SMS", "EMAIL", "IN_APP"] as const;

export default function FacultyParentsPage() {
  const router = useRouter();
  const { data: batches } = useFacultyBatches();
  const [batchId, setBatchId] = useState("");
  const [view, setView] = useState<"list" | "compose" | "bulk">("list");
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  const [search, setSearch] = useState("");
  const [composeData, setComposeData] = useState({
    subject: "",
    message: "",
    channel: "IN_APP" as "SMS" | "EMAIL" | "IN_APP",
  });
  const [bulkTemplate, setBulkTemplate] = useState(
    `Dear {parentName},\n\nThis is a progress update for {studentName} in {batchName}:\n\nAttendance: {attendancePct}%\nAverage Score: {avgScore}%\n\nPlease log in to the Neuron Academy portal for detailed reports.\n\nBest regards,\nNeuron Academy Faculty`
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sendState, setSendState] = useState<string | null>(null);

  const { data: students } = useFacultyStudents({ batchId: batchId || undefined });
  const { data: messages } = useParentMessages(selectedStudent?.id);
  const sendMut = useSendParentMessage({ onSuccess: () => { setView("list"); setComposeData({ subject: "", message: "", channel: "IN_APP" }); } });
  const bulkMut = useSendBulkParentReport({ onSuccess: () => { setView("list"); setSendState("Bulk reports sent to all parents in batch."); } });

  useEffect(() => {
    if (batches?.length && !batchId) setBatchId(batches[0].id);
  }, [batches, batchId]);

  function openCompose(student: StudentRow) {
    setSelectedStudent(student);
    setComposeData({ subject: `Progress Update: ${student.name}`, message: "", channel: "IN_APP" });
    setView("compose");
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    setErr(null);
    setBusy(true);
    try {
      await sendMut.mutateAsync({
        studentId: selectedStudent.id,
        subject: composeData.subject,
        message: composeData.message,
        channel: composeData.channel,
      });
      setSendState("Message sent successfully!");
      setTimeout(() => setSendState(null), 3000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkSend(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId) return;
    setErr(null);
    setBusy(true);
    try {
      await bulkMut.mutateAsync({ batchId, template: bulkTemplate });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Bulk send failed");
    } finally {
      setBusy(false);
    }
  }

  const filteredStudents = students?.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.studentId.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  if (view === "compose" && selectedStudent) {
    return (
      <FacultyShell title="Send Message" subtitle={`To parents of ${selectedStudent.name}`}>
        {err && <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p>}
        {sendState && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">{sendState}</p>}

        <div className="mb-4 rounded-card border border-silver-200 bg-white p-4 shadow-card">
          <p className="text-sm font-bold text-navy-700">{selectedStudent.name} ({selectedStudent.studentId})</p>
          <p className="text-[12px] text-muted">{selectedStudent.parentName ?? "No parent name"} · {selectedStudent.parentMobile ?? "No parent phone"}</p>
        </div>

        <form onSubmit={handleSend} className="space-y-3">
          <label className="block text-[12px] font-bold text-navy-700">Channel<select value={composeData.channel} onChange={(e) => setComposeData({...composeData, channel: e.target.value as "SMS"|"EMAIL"|"IN_APP"})} className="mt-1.5 w-full rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500">
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
          <label className="block text-[12px] font-bold text-navy-700">Subject<input value={composeData.subject} onChange={(e) => setComposeData({...composeData, subject: e.target.value})} required className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
          <label className="block text-[12px] font-bold text-navy-700">Message<textarea value={composeData.message} onChange={(e) => setComposeData({...composeData, message: e.target.value})} rows={5} required className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500" /></label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setView("list"); setSelectedStudent(null); }} className="rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-navy-700 hover:border-teal-500">Cancel</button>
            <button type="submit" disabled={busy || sendMut.isPending} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60 flex items-center gap-2">
              <Send className="h-4 w-4" /> {busy || sendMut.isPending ? "Sending…" : "Send Message"}
            </button>
          </div>
        </form>
      </FacultyShell>
    );
  }

  if (view === "bulk") {
    return (
      <FacultyShell title="Bulk Parent Report" subtitle={`Send progress reports to all parents in ${batches?.find((b) => b.id === batchId)?.name ?? "selected batch"}`}>
        {err && <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p>}
        {sendState && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-bold text-emerald-700">{sendState}</p>}

        <form onSubmit={handleBulkSend} className="space-y-3">
          <p className="text-sm text-muted">{`Available variables: {studentName}, {parentName}, {attendancePct}, {avgScore}, {batchName}`}</p>
          <label className="block text-[12px] font-bold text-navy-700">Message Template<textarea value={bulkTemplate} onChange={(e) => setBulkTemplate(e.target.value)} rows={8} className="mt-1.5 w-full rounded-xl border border-silver-300 px-3 py-2 text-sm outline-none focus:border-teal-500 font-mono text-[12px]" /></label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setView("list")} className="rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-navy-700 hover:border-teal-500">Cancel</button>
            <button type="submit" disabled={busy || bulkMut.isPending} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 disabled:opacity-60 flex items-center gap-2">
              <Send className="h-4 w-4" /> {busy || bulkMut.isPending ? "Sending…" : "Send to All Parents"}
            </button>
          </div>
        </form>
      </FacultyShell>
    );
  }

  return (
    <FacultyShell title="Parent Communication" subtitle="1:1 messages & bulk progress reports">
      {err && <p className="mb-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-[13px] font-bold text-crimson" role="alert">{err}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-xl border border-silver-300 bg-white px-3 py-2 text-[13px] font-bold text-navy-700">
          {batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students…" className="min-w-[250px] flex-1 rounded-xl border border-silver-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" />
        <button onClick={() => setView("bulk")} className="rounded-xl border border-silver-300 px-4 py-2 text-sm font-bold text-navy-700 hover:border-teal-500 flex items-center gap-2"><FileText className="h-4 w-4" /> Bulk Report</button>
      </div>

      {filteredStudents.length === 0 ? (
        <p className="rounded-card border border-dashed border-silver-300 bg-white p-8 text-center text-sm font-bold text-muted">No students in this batch.</p>
      ) : (
        <div className="space-y-3">
          {filteredStudents.map((student) => (
            <div key={student.id} className="rounded-card border border-silver-200 bg-white p-4 shadow-card hover:border-teal-300 hover:shadow-lg transition">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-teal-600" />
                  <div>
                    <p className="font-extrabold text-navy-700">{student.name}</p>
                    <p className="text-[12px] text-muted">{student.studentId} · {student.parentName ?? "No parent"} · {student.parentMobile ?? "No phone"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                    student.parentMobile ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  )}>
                    {student.parentMobile ? "Contact Available" : "No Contact"}
                  </span>
                  <button onClick={() => openCompose(student)} className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-bold text-white hover:bg-navy-800 flex items-center gap-2">
                    <Send className="h-4 w-4" /> Message
                  </button>
                </div>
              </div>
              {messages && messages.length > 0 && (
                <div className="mt-3 pt-3 border-t border-silver-100">
                  <p className="text-[12px] font-bold text-muted mb-2">Recent Messages</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {messages.slice(0, 3).map((msg) => (
                      <div key={msg.id} className="rounded-xl bg-silver-50 px-3 py-2 text-[12px]">
                        <span className="font-bold text-navy-700">{msg.subject}</span> — {msg.message.slice(0, 60)}{msg.message.length > 60 ? "…" : ""}
                        <span className="ml-2 text-muted">({msg.channel} • {new Date(msg.sentAt).toLocaleDateString()})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </FacultyShell>
  );
}