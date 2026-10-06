"use client";

// C1 canonicalization — every test attempt runs on the server-backed engine.
// The legacy localStorage flow (getTestById/getQuestionById/evaluateTest +
// draftKey/getResultFor) is removed: BankQuestion rows carry answer keys,
// so loading them into the browser leaks keys before submission.
// DbAttempt is authoritative: keyless question delivery, server-side access
// gates (FREE/PAID/PRIVATE, batch, scholarship), single-attempt resume,
// server evaluation, and post-submit review. No local engine here.

import { useParams } from "next/navigation";
import { DbAttempt } from "@/components/student/DbAttempt";
import { useStudentGuard } from "@/components/student/useStudentGuard";

export default function StudentTestAttemptPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const session = useStudentGuard();
  if (!session)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>
    );
  return <DbAttempt testId={id} />;
}
