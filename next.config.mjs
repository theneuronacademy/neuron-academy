/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 12: PDF/OCR stack stays out of the webpack bundle (native binary
  // + WASM + ESM-only parser load at runtime via dynamic import instead).
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pdfjs-dist"],
  // Biometric ADMS: eSSL/ZKTeco-class devices push to fixed /iclock/* paths
  // (they cannot be reconfigured to /api/*). Rewrite them onto the tolerant
  // ADMS receiver, preserving the sub-path so it can tell registration
  // (cdata) from command polling (getrequest/devicecmd).
  async rewrites() {
    return [
      { source: "/iclock/:path*", destination: "/api/biometric/adms?admsPath=:path*" },
    ];
  },
};

export default nextConfig;
