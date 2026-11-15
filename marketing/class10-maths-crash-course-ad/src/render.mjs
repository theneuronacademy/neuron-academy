// Renders ad.html frame-by-frame (1080x1920, 30 fps) and pipes frames to ffmpeg.
// Usage: node render.mjs <out-silent.mp4> [seconds] [page.html]   (needs the "playwright" package and ffmpeg)
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const FPS = 30;
const DUR = Number(process.argv[3] || 64);
const here = path.dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("file://" + path.join(here, process.argv[4] || "ad.html"));
await page.evaluate(() => document.fonts.ready);

const ff = spawn(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
   "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-r", String(FPS), process.argv[2]],
  { stdio: ["pipe", "inherit", "inherit"] },
);

for (let f = 0; f < FPS * DUR; f++) {
  await page.evaluate((t) => window.seek(t), f / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 300 === 0) console.log("frame", f);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("done");
