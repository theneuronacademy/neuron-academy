// Thin service re-export so both `lib/test/pdfParser.ts` and
// `services/pdfParser.ts` resolve (spec references both paths).
export * from "@/lib/test/pdfParser";
export { PDFTextProvider } from "@/lib/test/pdfParser";
