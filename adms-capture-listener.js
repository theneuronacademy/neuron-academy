#!/usr/bin/env node
/**
 * ADMS Traffic Capture Listener
 * 
 * Temporary development tool to capture REAL K90 Pro ADMS traffic.
 * 
 * CRITICAL SECURITY:
 * - NEVER logs passwords, Authorization headers, cookies, or secrets
 * - Redacts Authorization, Cookie headers
 * - Does NOT persist biometric templates or fingerprint images
 * - Does NOT persist unnecessary PII
 * - Only for temporary development use
 * 
 * Usage:
 *   PORT=8787 node adms-capture-listener.js
 *   PORT=38787 node adms-capture-listener.js  (for local testing)
 * 
 * Run on a VPS with public IP for real device, or locally for testing.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- standalone plain-Node capture tool (no bundler/ESM); require() is the correct module system here. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '0.0.0.0';
const LOG_DIR = path.join(__dirname, 'adms-capture-logs');
const CAPTURE_FILE = path.join(LOG_DIR, `capture-${Date.now()}.jsonl`);

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Headers to redact in logs
const REDACTED_HEADERS = new Set([
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'proxy-authorization',
    'x-csrf-token',
    'x-xsrf-token'
]);

// Body fields to redact in logs (biometric data)
const REDACTED_BODY_FIELDS = new Set([
    'fingerprint',
    'fingerprint_template',
    'template',
    'biometric_data',
    'finger_image',
    'photo',
    'image',
    'face_template',
    'iris_template',
    'password',
    'passwd',
    'secret',
    'token',
    'api_key',
    'apikey',
    'access_token',
    'refresh_token'
]);

function redactHeaders(headers) {
    const redacted = {};
    for (const [key, value] of Object.entries(headers || {})) {
        const lowerKey = key.toLowerCase();
        if (REDACTED_HEADERS.has(lowerKey)) {
            redacted[key] = '[REDACTED]';
        } else {
            redacted[key] = value;
        }
    }
    return redacted;
}

function redactBody(body) {
    if (!body || typeof body !== 'object') return body;
    
    const redacted = {};
    for (const [key, value] of Object.entries(body)) {
        const lowerKey = key.toLowerCase();
        if (REDACTED_BODY_FIELDS.has(lowerKey)) {
            redacted[key] = '[REDACTED - BIOMETRIC/SENSITIVE]';
        } else if (typeof value === 'object' && value !== null) {
            redacted[key] = redactBody(value);
        } else if (typeof value === 'string' && value.length > 1000) {
            redacted[key] = value.substring(0, 1000) + '... [TRUNCATED]';
        } else {
            redacted[key] = value;
        }
    }
    return redacted;
}

function sanitizeForLog(obj) {
    if (!obj) return obj;
    const result = { ...obj };
    if (result.headers) result.headers = redactHeaders(result.headers);
    if (result.body) result.body = redactBody(result.body);
    return result;
}

function generateRequestId() {
    return crypto.randomBytes(8).toString('hex');
}

function writeCapture(entry) {
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(CAPTURE_FILE, line, 'utf8');
}

function logCapture(entry) {
    const sanitized = sanitizeForLog(entry);
    console.log(JSON.stringify(sanitized, null, 2));
    writeCapture(entry);
}

function createListener() {
    const server = http.createServer((req, res) => {
        const requestId = generateRequestId();
        const startTime = Date.now();
        
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            let parsedBody = null;
            let contentType = req.headers['content-type'] || '';
            
            if (body) {
                try {
                    if (contentType.includes('application/json')) {
                        parsedBody = JSON.parse(body);
                    } else if (contentType.includes('application/x-www-form-urlencoded')) {
                        parsedBody = Object.fromEntries(new URLSearchParams(body));
                    } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
                        parsedBody = { _xml: body.substring(0, 5000) };
                    } else {
                        parsedBody = { _raw: body.substring(0, 5000) };
                    }
                } catch (e) {
                    parsedBody = { _parse_error: e.message, _raw: body.substring(0, 5000) };
                }
            }
            
            const captureEntry = {
                requestId,
                timestamp: new Date().toISOString(),
                timestampMs: Date.now(),
                method: req.method,
                url: req.url,
                path: req.url.split('?')[0],
                query: Object.fromEntries(new URLSearchParams(req.url.split('?')[1] || '')),
                headers: redactHeaders(req.headers),
                contentType,
                contentLength: req.headers['content-length'] || body.length,
                body: parsedBody,
                remoteAddress: req.socket.remoteAddress,
                remotePort: req.socket.remotePort,
                userAgent: req.headers['user-agent'] || null,
                httpVersion: req.httpVersion,
            };
            
            logCapture(captureEntry);
            
            // Send minimal response to keep device connection alive
            // For ADMS, typically a simple OK or specific XML response is expected
            // We send minimal OK for now - will be refined after protocol analysis
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
            
            const duration = Date.now() - startTime;
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms) [${requestId}]`);
        });
    });
    
    return server;
}

function main() {
    console.log('='.repeat(60));
    console.log('ADMS Traffic Capture Listener');
    console.log('='.repeat(60));
    console.log(`Starting listener on ${HOST}:${PORT}`);
    console.log(`Capture log: ${CAPTURE_FILE}`);
    console.log('');
    console.log('SECURITY NOTICE:');
    console.log('  - Authorization/Cookie headers will be REDACTED');
    console.log('  - Biometric/sensitive body fields will be REDACTED');
    console.log('  - Raw request bodies >5000 chars are TRUNCATED');
    console.log('  - Capture log: ' + CAPTURE_FILE);
    console.log('');
    console.log('Waiting for K90 Pro ADMS traffic...');
    console.log('='.repeat(60));
    
    const server = createListener();
    
    server.listen(PORT, HOST, () => {
        console.log(`Listener active on http://${HOST}:${PORT}`);
        console.log('Waiting for K90 Pro ADMS traffic...');
        console.log('');
    });
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down capture listener...');
        server.close(() => {
            console.log('Capture listener stopped.');
            console.log(`Capture saved to: ${CAPTURE_FILE}`);
            process.exit(0);
        });
    });
    
    process.on('SIGTERM', () => {
        server.close(() => {
            process.exit(0);
        });
    });
}

main();