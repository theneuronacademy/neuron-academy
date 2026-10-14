#!/usr/bin/env node
/**
 * adms-bridge.js — Production ADMS bridge (eSSL K90 Pro → Neuron Academy).
 *
 * The K90 pushes to a FIXED path (GET/POST /iclock/cdata, port 8787, plain
 * HTTP) that Vercel/Next.js cannot serve directly. This tiny dependency-free
 * Node server runs on an always-on host (VPS) with port 8787 open, speaks the
 * device-facing ADMS dialect, and forwards canonical JSON events to the
 * Next.js ingestion endpoint with the per-device bearer secret.
 *
 *   K90 Pro --(ADMS :8787)--> adms-bridge --(HTTPS + Bearer)--> Next.js
 *                              /api/biometric/[deviceId]/events
 *
 * Parsing mirrors lib/adms.ts (ATTLOG tab-separated punches, IST device
 * clock). Keep the two in sync when either changes.
 *
 * SECURITY:
 *  - Device secrets come ONLY from environment, are NEVER logged, and are
 *    only ever sent as an Authorization header to NEXT_API_URL (HTTPS).
 *  - Unknown serials get "UNKNOWN DEVICE" and nothing is forwarded.
 *  - No biometric templates/images are handled here (attendance metadata only).
 *
 * ENV (all required unless noted):
 *   NEXT_API_URL        Base URL of the Next.js deployment, e.g.
 *                       https://academy.example.com (http only for local test)
 *   DEVICE_ID           BiometricDevice.id (cuid) for single-device setups
 *   DEVICE_SECRET       Provisioned bridge secret (shown once at registration)
 *   BRIDGE_DEVICES_JSON Optional multi-device map, overrides DEVICE_ID/SECRET:
 *                       {"<SN>":{"deviceId":"...","secret":"..."}}
 *   PORT                default 8787 | HOST default 0.0.0.0
 *   REQUEST_TIMEOUT_MS  default 10000 | FORWARD_RETRIES default 3
 *
 * Run: PORT=8787 NEXT_API_URL=https://... DEVICE_ID=... DEVICE_SECRET=... node adms-bridge.js
 */

/* eslint-disable @typescript-eslint/no-require-imports -- standalone plain-Node bridge (no bundler/ESM); require() is correct here. */
const http = require('http');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NEXT_API_URL = (process.env.NEXT_API_URL || '').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10);
const FORWARD_RETRIES = parseInt(process.env.FORWARD_RETRIES || '3', 10);

let deviceBindings = {};
try {
  if (process.env.BRIDGE_DEVICES_JSON) {
    deviceBindings = JSON.parse(process.env.BRIDGE_DEVICES_JSON);
  } else if (process.env.DEVICE_ID) {
    deviceBindings.__default__ = { deviceId: process.env.DEVICE_ID, secret: process.env.DEVICE_SECRET || '' };
  }
} catch (e) {
  console.error('[bridge] BRIDGE_DEVICES_JSON is not valid JSON:', e.message);
  process.exit(1);
}

if (!NEXT_API_URL) {
  console.error('[bridge] NEXT_API_URL is required.');
  process.exit(1);
}
if (Object.keys(deviceBindings).length === 0) {
  console.error('[bridge] No device bindings: set DEVICE_ID/DEVICE_SECRET or BRIDGE_DEVICES_JSON.');
  process.exit(1);
}

const stats = { registrations: 0, polls: 0, punches: 0, forwarded: 0, failed: 0, unknownSerial: 0, startedAt: new Date().toISOString() };

function bindingFor(sn) {
  return deviceBindings[sn] || deviceBindings.__default__ || null;
}

// --- ATTLOG parsing (mirror of lib/adms.ts; keep in sync) -----------------
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function parseTimestamp(s) {
  s = String(s || '').trim();
  if (!s) return null;
  if (/[zZ]$/.test(s) || /[+-]\d{2}:?\d{2}$/.test(s) || /T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - IST_OFFSET_MS;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function parseAttLog(body) {
  const punches = [];
  let skipped = 0;
  for (const rawLine of String(body || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const fields = line.split('\t').length >= 2 ? line.split('\t') : line.split(/\s{2,}|\s/);
    const pin = (fields[0] || '').trim();
    const ts = parseTimestamp((fields[1] || '').trim());
    if (!pin || !ts) { skipped += 1; continue; }
    const status = parseInt((fields[2] || '0').trim(), 10);
    punches.push({ pin, ts, status: Number.isFinite(status) ? status : 0 });
  }
  return { punches, skipped };
}

function registrationResponse(sn) {
  return [
    `GET OPTION FROM: ${sn}`,
    'ATTLOGStamp=None',
    'OPERLOGStamp=None',
    'ATTPHOTOStamp=None',
    'ErrorDelay=30',
    'Delay=10',
    'TransTimes=00:00;14:05',
    'TransInterval=1',
    'TransFlag=TransData AttLog',
    'Realtime=1',
    'Encrypt=None',
    'TimeZone=330',
    'ServerVer=1.0 NeuronAcademy-ADMS',
  ].join('\n');
}

// --- Forwarding -------------------------------------------------------------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function forwardEvent(deviceId, secret, payload) {
  const url = `${NEXT_API_URL}/api/biometric/${deviceId}/events`;
  let lastErr = null;
  for (let attempt = 1; attempt <= FORWARD_RETRIES + 1; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) return { ok: true, status: res.status };
      lastErr = `HTTP ${res.status}`;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { ok: false, status: res.status, error: lastErr }; // no retry on client errors
      }
    } catch (e) {
      lastErr = e.message || String(e);
    }
    if (attempt <= FORWARD_RETRIES) await sleep(1000 * attempt);
  }
  return { ok: false, error: lastErr };
}

// --- HTTP server ------------------------------------------------------------
function send(res, code, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': contentType });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => {
    body += c.toString();
    if (body.length > 1_000_000) req.destroy();
  });
  req.on('end', async () => {
    try {
      const u = new URL(req.url, 'http://local');
      const path = u.pathname.toLowerCase();

      if (path === '/healthz') {
        return send(res, 200, JSON.stringify({ ok: true, ...stats }), 'application/json');
      }

      const sn = (u.searchParams.get('SN') || u.searchParams.get('sn') || '').trim();
      if (!sn) return send(res, 400, 'MISSING SN');

      const binding = bindingFor(sn);
      if (!binding) {
        stats.unknownSerial += 1;
        console.warn(`[bridge] unknown serial rejected (serial redacted to suffix): ...${sn.slice(-4)}`);
        return send(res, 404, 'UNKNOWN DEVICE');
      }

      if (req.method === 'GET' && (path.includes('getrequest') || path.includes('devicecmd') || path.includes('ping'))) {
        stats.polls += 1;
        return send(res, 200, 'OK');
      }

      if (req.method === 'GET') {
        stats.registrations += 1;
        // Best-effort heartbeat so Next.js presence stays truthful.
        forwardEvent(binding.deviceId, binding.secret, { biometricUserId: 'bridge', eventType: 'HEARTBEAT' }).catch(() => {});
        return send(res, 200, registrationResponse(sn));
      }

      if (req.method === 'POST') {
        const table = (u.searchParams.get('table') || '').toUpperCase();
        if (table && table !== 'ATTLOG') return send(res, 200, 'OK'); // OPERLOG/devicecmd: ack only
        const { punches, skipped } = parseAttLog(body);
        if (skipped > 0) console.warn(`[bridge] ${skipped} malformed ATTLOG lines skipped (SN ...${sn.slice(-4)})`);
        for (const p of punches) {
          stats.punches += 1;
          const result = await forwardEvent(binding.deviceId, binding.secret, {
            biometricUserId: p.pin,
            eventType: p.status === 1 ? 'CHECK_OUT' : 'CHECK_IN',
            eventTimestamp: p.ts.toISOString(),
            extra: undefined,
          }).catch((e) => ({ ok: false, error: e.message }));
          // Drop undefined keys (canonical contract ignores them, keep payload clean).
          if (result.ok) stats.forwarded += 1;
          else {
            stats.failed += 1;
            console.error(`[bridge] forward failed for punch (SN ...${sn.slice(-4)}): ${result.error || result.status}`);
          }
        }
        return send(res, 200, 'OK'); // always OK: Next.js dedupes retries idempotently
      }

      return send(res, 405, 'METHOD NOT ALLOWED');
    } catch (e) {
      console.error('[bridge] request error:', e.message);
      try { send(res, 500, 'BRIDGE ERROR'); } catch { /* socket gone */ }
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log('Neuron Academy ADMS bridge');
  console.log('='.repeat(60));
  console.log(`Listening:      http://${HOST}:${PORT}  (device target)`);
  console.log(`Forwarding to:  ${NEXT_API_URL} (secret redacted)`);
  console.log(`Devices bound:  ${Object.keys(deviceBindings).length}`);
  console.log('Health:         GET /healthz');
  console.log('='.repeat(60));
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
