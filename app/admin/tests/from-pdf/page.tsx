"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminGuard } from "@/components/admin/useAdminGuard";
import { Button } from "@/components/ui/primitives";
import { parseQuestionsFromText, samplePaperText } from "@/lib/test/pdfParser";
import { PDFTextProvider, type ExtractedQuestion } from "@/services/questionExtraction";
import { importExtracted } from "@/services/questionService";
import { createDraftTest } from "@/services/testService";

type Phase = "idle" | "processing" | "done" | "failed";

const STEPS = [
  "Reading PDF",
  "Extracting text",
  "Detecting questions",
  "Detecting options",
  "Detecting answer information",
  "Preparing question bank",
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function FromPdfPage() {
  const ready = useAdminGuard();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(-1);
  const [pages, setPages] = useState(0);
  const [extracted, setExtracted] = useState<ExtractedQuestion[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const pick = (f: File | undefined) => {
    setError(null);
    setExtracted([]);
    setPhase("idle");
    setStepIdx(-1);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported. Please choose a .pdf file.");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setError("This PDF is larger than 25MB. Please use a smaller file for the demo.");
      return;
    }
    setFile(f);
  };

  const runExtraction = async (target: File | null, demoText: string | null, sourceName: string) => {
    setError(null);
    setPhase("processing");
    setExtracted([]);
    try {
      // Realistic staged progress for the demo while real work runs.
      const provider = new PDFTextProvider();
      const work: Promise<ExtractedQuestion[]> = demoText
        ? (async () => {
            await wait(600);
            return parseQuestionsFromText(demoText, sourceName);
          })()
        : provider.extractQuestions(target as File, sourceName);
      for (let i = 0; i < STEPS.length; i++) {
        setStepIdx(i);
        await wait(i === 1 ? 700 : 420);
        if (i === 1 && !demoText && target) {
          // Surface page count early when available.
          provider.extractText(target).then((r) => setPages(r.pages)).catch(() => undefined);
        }
      }
      const list = await work;
      if (list.length === 0) {
        setPhase("failed");
        setError("No questions were detected. This PDF may be scanned (images only) — OCR is planned for the next phase. Try Demo Mode or create manually.");
        return;
      }
      setExtracted(list);
      setPhase("done");
    } catch {
      setPhase("failed");
      setError("Unable to read this PDF. Try Demo Mode or upload a text-based PDF.");
    } finally {
      setStepIdx(-1);
    }
  };

  const high = extracted.filter((e) => !e.needsReview).length;
  const needReview = extracted.length - high;
  const missingAns = extracted.filter((e) => e.correctAnswer === null).length;

  const continueToReview = () => {
    const bank = importExtracted(extracted, file?.name ?? "demo-percentage-set.pdf");
    const name = (file?.name ?? "Percentage Practice Test").replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim() || "Percentage Practice Test";
    const t = createDraftTest({
      name: name.length > 60 ? name.slice(0, 60) : name,
      description: `Imported from ${file?.name ?? "demo paper"} • review before publishing.`,
      subject: "Quantitative Aptitude",
      chapter: "Percentage",
      questionIds: bank.map((q) => q.id),
      durationMinutes: Math.max(10, bank.length * 2),
      marksPerQuestion: 2,
      negativeMarks: 0.5,
      difficulty: "Mixed",
      source: "pdf",
    });
    router.push(`/admin/tests/${t.id}/questions`);
  };

  if (!ready) return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-muted">Loading…</div>;

  return (
    <AdminLayout title="Create Test From PDF" subtitle="Upload a question paper and convert it into a digital test">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-[15px] font-extrabold text-navy-700">1. Upload PDF</h2>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={`mt-3 cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${dragOver ? "border-teal-500 bg-teal-50" : "border-silver-300 bg-silver-50/60 hover:border-teal-400"}`}
            role="button"
            aria-label="Upload PDF"
          >
            <Upload className="mx-auto h-8 w-8 text-teal-600" />
            <p className="mt-2 text-sm font-extrabold text-navy-700">Drag & Drop PDF here</p>
            <p className="text-[13px] text-muted">or <span className="font-bold text-teal-600 underline">Browse PDF</span></p>
            <p className="mt-1 text-[11px] text-muted">PDF only • max 25MB • text-based PDFs work best</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="Browse PDF" />
          </div>

          {file ? (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-silver-200 bg-white px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-bold text-navy-700">
                <FileText className="h-4 w-4 text-teal-600" /> {file.name}
                <span className="font-semibold text-muted">({(file.size / 1024).toFixed(0)} KB{pages ? ` • ${pages} pages` : ""})</span>
              </p>
              <button onClick={() => { setFile(null); setExtracted([]); setPhase("idle"); }} aria-label="Remove file" className="rounded-lg p-1.5 hover:bg-silver-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-xl bg-crimson-50 px-4 py-2.5 text-sm font-bold text-crimson-DEFAULT" role="alert">{error}</p>
          ) : null}

          <div className="mt-4 grid gap-2">
            <Button disabled={!file || phase === "processing"} onClick={() => runExtraction(file, null, file?.name ?? "upload.pdf")}>
              {phase === "processing" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {phase === "processing" ? "Processing…" : "Process PDF"}
            </Button>
            <Button variant="outline" disabled={phase === "processing"} onClick={() => runExtraction(null, samplePaperText(), "demo-percentage-set.pdf")}>
              <Sparkles className="h-4 w-4" /> Use Demo Paper Instead (12 Percentage Qs)
            </Button>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Text-based PDF extraction is implemented. OCR/AI extraction for scanned PDFs is prepared for the next phase. Questions are auto-extracted and must be reviewed before publishing — answers are never invented.
          </p>
        </div>

        <div className="rounded-card border border-silver-200 bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-[15px] font-extrabold text-navy-700">2. Processing & Result</h2>
          {phase === "idle" ? <p className="mt-3 text-sm text-muted">Upload a PDF and click <b>Process PDF</b> — staged progress appears here.</p> : null}
          {phase === "processing" ? (
            <ol className="mt-3 space-y-2.5">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-bold ${i < stepIdx ? "border-teal-100 bg-teal-50 text-teal-700" : i === stepIdx ? "border-navy-700 bg-navy-700 text-white" : "border-silver-200 text-muted"}`}>
                  {i < stepIdx ? "✓" : i === stepIdx ? <Loader2 className="h-4 w-4 animate-spin" /> : "○"} {s}
                  {i === stepIdx ? <span className="sr-only">(in progress)</span> : null}
                </li>
              ))}
            </ol>
          ) : null}
          {phase === "done" ? (
            <div className="mt-3">
              <div className="rounded-2xl bg-navy-800 p-5 text-white">
                <p className="text-3xl font-extrabold">{extracted.length} Questions Detected</p>
                <p className="mt-1 text-sm text-silver-200">{high} High Confidence • {needReview} Need Review • {missingAns} Missing Answers</p>
              </div>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {extracted.slice(0, 6).map((e, i) => (
                  <p key={e.id} className="rounded-xl border border-silver-200 bg-silver-50/60 px-3.5 py-2 text-[13px]">
                    <span className="font-extrabold text-navy-700">Q{i + 1}.</span> {e.question.slice(0, 90)}{e.question.length > 90 ? "…" : ""}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${e.needsReview ? "bg-crimson-50 text-crimson-DEFAULT" : "bg-teal-50 text-teal-700"}`}>
                      {e.confidence}%
                    </span>
                  </p>
                ))}
                {extracted.length > 6 ? <p className="text-[12px] font-bold text-muted">+ {extracted.length - 6} more — review them all on the next screen.</p> : null}
              </div>
              <Button onClick={continueToReview} size="lg" className="mt-4 w-full">Review Questions →</Button>
            </div>
          ) : null}
          {phase === "failed" ? <p className="mt-3 text-sm text-muted">Extraction failed gracefully — nothing was invented. Use Demo Mode above.</p> : null}
        </div>
      </div>
    </AdminLayout>
  );
}
