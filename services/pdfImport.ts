// Phase 12 — server-side PDF text extraction (pdfjs-dist, Node runtime).
// SERVER-ONLY: imports pdfjs-dist legacy build — never import from clients.
// No binaries stored; callers receive page texts + availability flags.

export interface ExtractedPage {
  page: number;
  text: string;
  /** Usable embedded text present (≥ TEXT_THRESHOLD chars). */
  hasText: boolean;
}

export interface PdfTextResult {
  totalPages: number;
  pages: ExtractedPage[];
}

export const TEXT_THRESHOLD = 40;

interface PdfPage {
  getTextContent: () => Promise<{ items: unknown[] }>;
}

interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
}

export async function extractPdfText(data: Uint8Array): Promise<PdfTextResult> {
  // Dynamic import keeps the heavy parser out of unrelated route bundles.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const loading = pdfjs.getDocument({
      data,
      useWorkerFetch: false,
      useSystemFonts: true,
    });
    const pdf = (await loading.promise) as unknown as PdfDoc;
    const totalPages = pdf.numPages;
    const pages: ExtractedPage[] = [];
    for (let n = 1; n <= totalPages; n++) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      // Respect end-of-line markers — without them the whole page collapses
      // into one line and question boundaries are undetectable.
      let raw = "";
      for (const it of tc.items) {
        if (typeof it === "object" && it !== null && "str" in it) {
          raw += String((it as { str: unknown }).str);
          if ((it as { hasEOL?: boolean }).hasEOL) raw += "\n";
          else raw += " ";
        }
      }
      const text = raw
        .split("\n")
        .map((l) => l.replace(/[ \t]+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
      pages.push({ page: n, text, hasText: text.replace(/\s/g, "").length >= TEXT_THRESHOLD });
    }
    return { totalPages, pages };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/password|encrypt/i.test(msg)) {
      throw new Error("This PDF is password-protected. Please upload an unlocked copy.");
    }
    throw new Error("This file could not be read as a PDF. It may be corrupted.");
  }
}
