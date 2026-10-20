/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 12: PDF/OCR stack stays out of the webpack bundle (native binary
  // + WASM + ESM-only parser load at runtime via dynamic import instead).
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist"],
};

export default nextConfig;
