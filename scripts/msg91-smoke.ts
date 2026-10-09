// Phase 18 — MSG91 LIVE smoke test (sends ONE real SMS).
// Phase 18b — two controlled modes (exactly ONE send, never both):
//   OTP:          npm run msg91:smoke -- --phone=9876543210
//   Transactional flow SMS (NOT live-verified yet):
//                 npm run msg91:smoke -- --phone=9876543210 --flow-id=123... [--var=NAME:value ...]
// - Refuses to run when MSG91 env (AUTH_KEY/TEMPLATE_ID/SENDER_ID) or
//   SESSION_SECRET is missing (flow mode additionally needs --flow-id).
// - Requires an explicitly supplied --phone flag (Indian mobile).
// - Sends exactly ONE OTP / ONE flow SMS via the production provider path —
//   no retries, no resend, no spam.
// - NEVER prints credentials, the OTP value, or the full phone number.
// - OTP mode optionally verifies a manually entered OTP against the
//   in-memory hash (single check, mirrors server-side verifyOtpHash).
//   Nothing persisted.

import { createInterface } from "node:readline";
// Load .env for operator convenience (same mechanism as Next.js dev). Real
// credentials still never appear in code, logs, or output.
import "dotenv/config";
import {
  isOtpFormat,
  maskPhone,
  normalizeIndianMobile,
  otpExpiryMinutes,
  verifyOtpHash,
} from "../lib/otp";
import { isMsg91Configured, sendOtp, sendSms } from "../services/msg91";

function usage(): never {
  console.error("Usage (OTP): npm run msg91:smoke -- --phone=<10-digit Indian mobile>");
  console.error("Usage (flow): npm run msg91:smoke -- --phone=<mobile> --flow-id=<MSG91 flow id> [--var=NAME:value ...]");
  console.error("Example: npm run msg91:smoke -- --phone=9876543210");
  process.exit(2);
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  const arg = process.argv.find((a) => a.startsWith("--phone="));
  if (!arg) usage();
  const phone = normalizeIndianMobile(arg.split("=").slice(1).join("="));
  if (!phone) {
    console.error("msg91:smoke: invalid phone — enter a valid 10-digit Indian mobile number.");
    process.exit(2);
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
    console.error("msg91:smoke: SESSION_SECRET (>=16 chars) is required. Refusing to run.");
    process.exit(1);
  }
  if (!isMsg91Configured()) {
    console.error(
      "msg91:smoke: MSG91 is not configured. Set MSG91_AUTH_KEY, MSG91_TEMPLATE_ID and MSG91_SENDER_ID, then retry. Refusing to run."
    );
    process.exit(1);
  }

  const masked = maskPhone(phone);
  const flowArg = process.argv.find((a) => a.startsWith("--flow-id="));
  if (flowArg) {
    // Transactional flow mode: ONE controlled flow SMS (first live proof).
    const flowId = flowArg.split("=").slice(1).join("=").trim();
    if (!flowId) {
      console.error("msg91:smoke: --flow-id must not be empty. Refusing to run.");
      process.exit(2);
    }
    const vars: Record<string, string> = { academyName: "Neuron Academy" };
    for (const a of process.argv.filter((x) => x.startsWith("--var="))) {
      const pair = a.slice("--var=".length);
      const idx = pair.indexOf(":");
      if (idx > 0) vars[pair.slice(0, idx)] = pair.slice(idx + 1).slice(0, 500);
    }
    console.log(`msg91:smoke: sending ONE flow SMS to ${masked} (flow configured, vars=${Object.keys(vars).join(",")})…`);
    const sent = await sendSms(phone, flowId, vars);
    if (!sent.ok) {
      console.error(`msg91:smoke: flow send failed code=${sent.code} retryable=${sent.retryable === true}. No retry sent.`);
      process.exit(1);
    }
    console.log(`msg91:smoke: provider accepted flow SMS code=${sent.code} to ${masked}. Check the handset. Transactional SMS is LIVE.`);
    return;
  }
  console.log(`msg91:smoke: sending ONE OTP to ${masked} (expiry ${otpExpiryMinutes()} min)…`);

  const sent = await sendOtp(phone);
  if (!sent.ok || typeof sent.otpHash !== "string" || typeof sent.otp !== "string") {
    // sendOtp already logs a safe server diagnostic; surface only the safe code.
    console.error(`msg91:smoke: provider send failed code=${!sent.ok ? sent.code : "UNKNOWN"}. No SMS state persisted.`);
    process.exit(1);
  }
  console.log(`msg91:smoke: provider accepted send code=${sent.code} to ${masked}. Check the handset for the OTP.`);

  const code = (await ask("Enter the OTP you received (or press Enter to skip verification): ")).trim();
  if (!code) {
    console.log("msg91:smoke: verification skipped. Send path OK (provider accepted). NOT live-verified until an OTP is confirmed.");
    return;
  }
  if (!isOtpFormat(code)) {
    console.error("msg91:smoke: invalid format. Verification FAILED.");
    process.exit(1);
  }
  // Single in-memory check against the hash from this send (phone-bound, like
  // the verify route). No resend, no retry loop.
  if (verifyOtpHash(code, phone, sent.otpHash)) {
    console.log("msg91:smoke: OTP VERIFIED against this send. Integration is LIVE.");
  } else {
    console.error("msg91:smoke: OTP did NOT match this send. Verification FAILED (no retry sent).");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("msg91:smoke: unexpected error", err instanceof Error ? err.message : err);
  process.exit(1);
});
