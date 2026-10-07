# ADMS Traffic Capture Listener

Temporary development tool to capture **REAL K90 Pro ADMS traffic** for protocol discovery.

## ⚠️ CRITICAL SECURITY NOTICE

This tool is for **temporary development use only**. It is designed to capture the REAL ADMS protocol from a physical K90 Pro device.

### Security Guarantees
- ✅ **Authorization/Cookie headers REDACTED** in all logs
- ✅ **Biometric/sensitive body fields REDACTED** (fingerprint templates, images, templates)
- ✅ **Authorization/secret headers REDACTED** (Authorization, Cookie, API keys, tokens)
- ✅ **Raw request bodies >5000 chars TRUNCATED** to prevent large payloads in logs
- ✅ **NO biometric templates/images persisted** - only attendance/event metadata
- ✅ **NO secrets committed** - capture logs are local only, git-ignored

### What IS Captured
- HTTP method, path, query parameters
- Non-sensitive headers (User-Agent, Content-Type, etc.)
- Non-sensitive body fields (biometricUserId, eventType, timestamps, eventType)
- Device identification (serial number, MAC, IP)
- Attendance event format (user ID, event type, timestamp)
- Remote IP/port

### What is NOT Captured/Logged
- ❌ Authorization headers
- ❌ Cookies
- ❌ API keys / tokens / secrets
- ❌ Fingerprint templates / images
- ❌ Face/iris templates
- ❌ Passwords
- ❌ Full raw bodies >5000 chars

---

## Quick Start

### Local Testing (Port 38787)
```bash
# Terminal 1: Start capture listener
npm run start:local

# Terminal 2: Test with curl
curl -X POST http://localhost:38787/iclock/cdata \
  -H "Content-Type: application/json" \
  -d '{"biometricUserId":"001","eventType":"CHECK_IN","eventTimestamp":"2024-01-15T08:00:00Z"}'
```

### Production Capture (VPS - Port 8787)
```bash
# On VPS with public IP, as root or with authbind
sudo PORT=8787 node adms-capture-listener.js

# Or with authbind (non-root):
sudo apt-get install authbind
authbind --deep PORT=8787 node adms-capture-listener.js
```

---

## Capture Output

### Console Output
Real-time request logging:
```
[2024-01-15T08:00:00.123Z] POST /iclock/cdata - 200 (45ms) [a1b2c3d4]
```

### Capture Log File (JSONL)
File: `adms-capture-logs/capture-<timestamp>.jsonl`

Each line is a complete JSON object:
```json
{
  "requestId": "a1b2c3d4",
  "timestamp": "2024-01-15T08:00:00.123Z",
  "timestampMs": 1705305600123,
  "method": "POST",
  "url": "/iclock/cdata?SN=K90PRO12345",
  "path": "/iclock/cdata",
  "query": { "SN": "K90PRO12345" },
  "headers": {
    "content-type": "application/json",
    "user-agent": "K90Pro/8.0.4.3",
    "authorization": "[REDACTED]"
  },
  "contentType": "application/json",
  "contentLength": 123,
  "body": {
    "biometricUserId": "001",
    "eventType": "CHECK_IN",
    "eventTimestamp": "2024-01-15T08:00:00Z",
    "deviceId": "K90PRO12345"
  },
  "remoteAddress": "203.0.113.42",
  "remotePort": 54321,
  "userAgent": "K90Pro/8.0.4.3",
  "httpVersion": "1.1"
}
```

---

## Physical Device Test Procedure

### 1. Prepare Capture Listener
```bash
# On VPS with public IP
git clone <repo>
cd neuron-academy
npm run start:vps
```

### 2. Backup Device Configuration
Record current K90 Pro settings:
- Server: `52.74.152.9`
- Port: `8787`
- Domain: `OFF`
- Proxy: `OFF`

### 3. Change Device Server
On K90 Pro device:
1. Menu → Comm → Server Setting
2. Server IP: `<VPS_PUBLIC_IP>`
3. Server Port: `8787`
4. Save

### 4. Capture First Request
Wait for device to connect (usually within 1-5 minutes).
First request is typically registration/heartbeat.

### 5. Trigger Test Attendance
1. Enroll test fingerprint on device (User ID: `001`)
2. Scan fingerprint on device
3. Capture attendance request

### 6. Analyze Capture
```bash
cat adms-capture-logs/capture-*.jsonl | jq .
```

### 7. Restore Device
Change server back to `52.74.152.9:8787`

---

## Expected ADMS Paths (Capture All)

The listener accepts ALL paths. Common eSSL paths:
- `/iclock/cdata` - attendance data
- `/iclock/getrequest` - device commands
- `/iclock/devicecmd` - device commands
- `/iclock/cdata.aspx` - ASP.NET variant
- `/api/attendance` - custom endpoints

**Capture ALL paths** - the listener records exact path received.

---

## Response Behavior

Current implementation returns minimal `OK` for all requests.
After protocol analysis, implement proper ADMS responses:

```javascript
// Example: ADMS heartbeat response
res.writeHead(200, { 'Content-Type': 'text/plain' });
res.end('OK');

// Example: ADMS command response
res.writeHead(200, { 'Content-Type': 'text/xml' });
res.end('<?xml version="1.0"?><Response><Result>OK</Result></Response>');
```

---

## Cleanup

After capture:
1. Stop listener (`Ctrl+C`)
2. Review capture file: `cat adms-capture-logs/capture-*.jsonl | jq .`
3. **Delete or archive** capture file (contains device IP, serial, user IDs)
3. **Do NOT commit** capture files to Git
4. Restore device to `52.74.152.9:8787`

---

## Files Created

| File | Description |
|------|-------------|
| `adms-capture-listener.js` | Main capture server |
| `package-capture.json` | npm package config |
| `ADMS-CAPTURE-README.md` | This file |
| `adms-capture-logs/` | Capture output directory (git-ignored) |

---

## Git Ignore

Add to `.gitignore`:
```
adms-capture-logs/
adms-capture-listener.js
package-capture.json
ADMS-CAPTURE-README.md
*.jsonl
```

---

## Next Steps After Capture

1. **Analyze captured traffic** - determine exact ADMS protocol
2. **Document protocol** - method, path, headers, body format
3. **Implement production parser** - based on real traffic
4. **Implement device authentication** - per discovered protocol
5. **Create BiometricUserMap migration** - for persistent mapping
5. **Deploy production ADMS listener** - VPS + reverse proxy
6. **Test with real device** - controlled smoke test

---

## DO NOT

- ❌ Commit capture logs to Git
- ❌ Modify device config automatically
- ❌ Send device commands (reboot, clear, delete)
- ❌ Assume ZKTeco/iClock docs apply to K90 Pro
- ❌ Deploy to Vercel directly (port 8787 not supported)
- ❌ Connect real device before protocol confirmed