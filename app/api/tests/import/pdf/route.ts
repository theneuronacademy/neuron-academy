// Phase 12 — PDF upload + processing (genuine pipeline, no mocks).
// Flow: validate → pdfjs text per page → OCR pages without text → (gated)
// deterministic parse → PdfImport + staging DRAFT test + PENDING questions.
// Limits: ≤10 MB, ≤50 pages, ≤10 OCR pages. Binaries never stored.
// Serverless boundary: text PDFs import fully; scanned/image pages need
// native canvas + Tesseract OCR, which is disabled unless OCR_ENABLED is set
// (dev/Docker/dedicated worker). Disabled OCR fails CLOSED with code
// OCR_NOT_AVAILABLE — never a fake COMPLETED state, never fake questions.

import { NextRequest, NextResponse } from "next/server";
import { dbNotConfigured, fail, ok, serverError } from "@/lib/api-response";
import { getDb } from "@/lib/prisma";
import { requireApiRole } from "@/lib/server-auth";
import { extractPdfText } from "@/services/pdfImport";
import { needsOcr, ocrEnabled, rasterizePdfPage, TesseractOcrProvider } from "@/services/ocrService";
import { parseQuestionsFromPages, type PageText } from "@/services/questionParser";

export const dynamic = "force-dynamic";
// Vercel: pdfjs + @napi-rs/canvas (native) + tesseract WASM only run on the
// Node.js runtime — never Edge. Text PDFs of up to 50 pages need headroom;
// scanned/image OCR is gated below (OCR_NOT_AVAILABLE) on serverless.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 50;
const MAX_OCR_PAGES = 10;

export async function POST(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Importing a PDF");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Invalid multipart upload.", 400);
  }
  const file = form.get("file");
  if (!file || typeof file === "string" || typeof (file as File).arrayBuffer !== "function") {
    return fail("A PDF file upload is required.", 400);
  }
  const pdf = file as File;
  const filename = pdf.name || "upload.pdf";
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return fail("Only .pdf files are supported.", 400);
  }
  if (pdf.type && !/pdf/i.test(pdf.type)) {
    return fail(`Unsupported file type "${pdf.type}". Upload a .pdf file.`, 400);
  }
  if (pdf.size <= 0) return fail("The uploaded file is empty.", 400);
  if (pdf.size > MAX_BYTES) {
    return fail("This PDF exceeds the 10 MB limit. Split it into smaller files.", 400);
  }
  const batchId = typeof form.get("batchId") === "string" && (form.get("batchId") as string).trim()
    ? String(form.get("batchId"))
    : null;
  const title = typeof form.get("title") === "string" && (form.get("title") as string).trim()
    ? String(form.get("title")).trim().slice(0, 120)
    : `Import: ${filename.replace(/\.pdf$/i, "").slice(0, 80)}`;
  const subject = typeof form.get("subject") === "string" && (form.get("subject") as string).trim()
    ? String(form.get("subject")).trim().slice(0, 60)
    : null;
  const marksPerQuestion = Number(form.get("marksPerQuestion") ?? 1);
  const negativeMarks = Number(form.get("negativeMarks") ?? 0);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await pdf.arrayBuffer());
  } catch {
    return fail("Could not read the uploaded file.", 400);
  }

  const imp = await db.pdfImport.create({
    data: {
      filename: filename.slice(0, 200),
      status: "PROCESSING",
      createdById: auth.user.id,
    },
  });

  try {
    const { totalPages, pages } = await extractPdfText(new Uint8Array(buffer));
    if (totalPages === 0) throw new Error("This PDF has no readable pages.");
    if (totalPages > MAX_PAGES) {
      throw new Error(`This PDF has ${totalPages} pages (limit ${MAX_PAGES}). Split it and upload in parts.`);
    }
    // Serverless OCR boundary: detect scanned/image pages from the cheap
    // text extraction BEFORE any native canvas/Tesseract work. When OCR is
    // disabled the job fails CLOSED here — no staging test, no questions,
    // no misleading PROCESSING record (row is marked FAILED with the reason).
    const scannedCount = pages.filter((p) => needsOcr(p.text)).length;
    if (scannedCount > 0 && !ocrEnabled()) {
      const reason =
        `This PDF has ${scannedCount} scanned/image page(s) that require OCR. ` +
        `Serverless OCR is not available: re-upload a text-based PDF, or run the import where OCR is enabled (OCR_ENABLED).`;
      await db.pdfImport.update({
        where: { id: imp.id },
        data: { status: "FAILED", totalPages, textPages: totalPages - scannedCount, ocrPages: 0, error: reason.slice(0, 500) },
      });
      return NextResponse.json({ success: false, error: reason, code: "OCR_NOT_AVAILABLE", scannedPages: scannedCount, textPages: totalPages - scannedCount }, { status: 422 });
    }
    // OCR pass for pages without embedded text.
    const ocr = new TesseractOcrProvider();
    const finalPages: PageText[] = [];
    let textPages = 0;
    let ocrPages = 0;
    let ocrFailed = 0;
    for (const p of pages) {
      if (!needsOcr(p.text)) {
        textPages += 1;
        finalPages.push({ page: p.page, text: p.text });
        continue;
      }
      if (ocrPages >= MAX_OCR_PAGES) {
        throw new Error(
          `More than ${MAX_OCR_PAGES} scanned pages need OCR — split the PDF and upload in parts.`
        );
      }
      try {
        const png = await rasterizePdfPage(new Uint8Array(buffer), p.page);
        const out = await ocr.recognizeImage(png);
        ocrPages += 1;
        if (!out.text || needsOcr(out.text)) {
          ocrFailed += 1;
          finalPages.push({ page: p.page, text: "" });
        } else {
          finalPages.push({ page: p.page, text: out.text });
        }
      } catch {
        ocrFailed += 1;
        finalPages.push({ page: p.page, text: "" });
      }
    }

    const parsed = parseQuestionsFromPages(finalPages);
    if (parsed.questions.length === 0) {
      const reason =
        ocrFailed > 0
          ? "Unable to reliably read this PDF (scanned pages unclear). Please upload a clearer PDF or add questions manually."
          : "No questions were detected in this PDF. Check the format or add questions manually.";
      await db.pdfImport.update({
        where: { id: imp.id },
        data: { status: "FAILED", totalPages, textPages, ocrPages, error: reason },
      });
      return fail(reason, 422);
    }

    const staging = await db.test.create({
      data: {
        title,
        description: `Staging pool imported from ${filename}. Approve questions, then generate a test.`,
        batchId,
        createdById: auth.user.id,
        type: "PRACTICE",
        status: "DRAFT",
      },
    });

    const mpq = Number.isFinite(marksPerQuestion) && marksPerQuestion > 0 ? marksPerQuestion : 1;
    const neg = Number.isFinite(negativeMarks) && negativeMarks >= 0 ? negativeMarks : 0;
    await db.question.createMany({
      data: parsed.questions.map((q, i) => ({
        testId: staging.id,
        questionText: q.stem || `(question ${q.number} — stem unclear, please edit)`,
        questionType: q.suggestedType === "TRUE_FALSE" ? "TRUE_FALSE" : "MCQ",
        optionA: q.options[0]?.text || null,
        optionB: q.options[1]?.text || null,
        optionC: q.options[2]?.text || null,
        optionD: q.options[3]?.text || null,
        optionE: q.options[4]?.text || null,
        correctAnswer: q.answer,
        marks: mpq,
        negativeMarks: neg,
        explanation: null,
        order: i,
        subject,
        sourceFile: filename.slice(0, 200),
        sourcePage: q.sourcePage,
        confidence: q.confidence,
        reviewStatus: "PENDING",
      })),
    });
    await db.test.update({
      where: { id: staging.id },
      data: { totalQuestions: parsed.questions.length, totalMarks: Math.round(parsed.questions.length * mpq * 100) / 100 },
    });

    const failedPagesNote = ocrFailed > 0 ? ` ${ocrFailed} page(s) could not be read reliably.` : "";
    const status = parsed.stats.needsReview > 0 ? "REVIEW_REQUIRED" : "COMPLETED";
    const updated = await db.pdfImport.update({
      where: { id: imp.id },
      data: {
        status,
        totalPages,
        textPages,
        ocrPages,
        questionsDetected: parsed.stats.detected,
        stagingTestId: staging.id,
        error: failedPagesNote ? failedPagesNote.trim() : null,
      },
    });

    return ok(
      {
        import: {
          id: updated.id,
          filename: updated.filename,
          status: updated.status,
          totalPages: updated.totalPages,
          textPages: updated.textPages,
          ocrPages: updated.ocrPages,
          error: updated.error,
        },
        stagingTestId: staging.id,
        stats: parsed.stats,
        issues: failedPagesNote ? [failedPagesNote.trim()] : [],
      },
      201
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : "PDF processing failed.";
    try {
      await db.pdfImport.update({ where: { id: imp.id }, data: { status: "FAILED", error: reason.slice(0, 500) } });
    } catch {
      /* ignore secondary failure */
    }
    if (/password|empty|limit|corrupt|read as a PDF|reliably|detected|scanned/i.test(reason)) {
      return fail(reason, 422);
    }
    return serverError("tests:import-pdf", err);
  }
}

export async function GET(req: NextRequest) {
  const auth = requireApiRole(req, ["ADMIN", "FACULTY"]);
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getDb();
  if (!db) return dbNotConfigured("Listing imports");
  try {
    const rows = await db.pdfImport.findMany({
      where: auth.user.role === "ADMIN" ? undefined : { createdById: auth.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok({ items: rows, source: "database" });
  } catch (err) {
    return serverError("tests:import-list", err);
  }
}
