// Question-extraction provider abstraction. Today's demo uses real
// text-based PDF extraction (PDFTextProvider). OCR / AI providers are
// stubbed interfaces for the next phase — no API key required now.

export interface ExtractedQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number | null; // never invented — null when not detected
  explanation: string;
  subject: string;
  chapter: string;
  difficulty: "Easy" | "Medium" | "Hard";
  source: string;
  confidence: number; // 0-100
  needsReview: boolean;
}

export interface QuestionExtractionProvider {
  readonly name: "pdf-text" | "ocr" | "ai";
  extractText(file: File): Promise<{ text: string; pages: number }>;
  extractQuestions(file: File, sourceName: string): Promise<ExtractedQuestion[]>;
}

export { PDFTextProvider } from "@/lib/test/pdfParser";

// ---- Future providers (prepared, not active) ----

export class OCRProvider implements QuestionExtractionProvider {
  readonly name = "ocr" as const;
  async extractText(): Promise<{ text: string; pages: number }> {
    throw new Error("OCR extraction is prepared for the next phase (scanned PDFs). Use text-based PDFs for this demo.");
  }
  async extractQuestions(): Promise<ExtractedQuestion[]> {
    throw new Error("OCR extraction is prepared for the next phase (scanned PDFs). Use text-based PDFs for this demo.");
  }
}

export class AIQuestionProvider implements QuestionExtractionProvider {
  readonly name = "ai" as const;
  async extractText(): Promise<{ text: string; pages: number }> {
    throw new Error("AI extraction is prepared for the next phase and requires configuration. Use text-based PDFs for this demo.");
  }
  async extractQuestions(): Promise<ExtractedQuestion[]> {
    throw new Error("AI extraction is prepared for the next phase and requires configuration. Use text-based PDFs for this demo.");
  }
}

export function getActiveProvider(): "pdf-text" {
  return "pdf-text";
}
