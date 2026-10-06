// Phase 12 — OCR provider abstraction (server-only).
// Pipeline: PDF page (no embedded text) → rasterize via pdfjs + canvas →
// recognize via the configured OcrProvider (tesseract.js, no credentials).
// Swap OCR engines by implementing OcrProvider — callers never touch vendors.

export interface OcrResult {
  text: string;
  /** Mean confidence 0–100 as reported by the engine. */
  confidence: number;
}

export interface OcrProvider {
  readonly name: string;
  recognizeImage(png: Buffer): Promise<OcrResult>;
}

const OCR_MIN_CHARS = 20;

/**
 * Whether native/WASM OCR may run in this environment. Scanned-image OCR
 * (canvas rasterize + Tesseract) is unreliable on Vercel serverless, so it
 * is disabled unless explicitly enabled: OCR_ENABLED=true|1|local (dev,
 * Docker, or the future dedicated OCR worker host). Text-PDF imports never
 * consult this flag. Never throws.
 */
export function ocrEnabled(): boolean {
  const v = (process.env.OCR_ENABLED ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "local";
}

export class TesseractOcrProvider implements OcrProvider {
  readonly name = "tesseract.js (eng)";

  async recognizeImage(png: Buffer): Promise<OcrResult> {
    // Dynamic imports keep native/WASM deps out of unrelated route bundles.
    const Tesseract = (await import("tesseract.js")).default;
    const worker = await Tesseract.createWorker("eng");
    try {
      const { data } = await worker.recognize(png);
      return { text: (data.text ?? "").trim(), confidence: Math.round(data.confidence ?? 0) };
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  }
}

/** Render one PDF page to PNG (white background, 2x scale for OCR quality). */
export async function rasterizePdfPage(data: Uint8Array, pageNumber: number, scale = 2): Promise<Buffer> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const loading = pdfjs.getDocument({ data, useWorkerFetch: false, useSystemFonts: true });
  const pdf = (await loading.promise) as {
    getPage: (n: number) => Promise<{
      getViewport: (o: { scale: number }) => { width: number; height: number };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (o: any) => { promise: Promise<void> };
    }>;
  };
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const png = await canvas.encode("png");
  return Buffer.from(png);
}

/** True when extracted text is too thin to parse — OCR is required. */
export function needsOcr(text: string): boolean {
  return text.replace(/\s/g, "").length < OCR_MIN_CHARS;
}
