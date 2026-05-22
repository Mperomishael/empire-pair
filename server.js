// server.js — Public session-ID generator portal for EMPIRE BOT-WAN.
// Run on a persistent Node host (Render, Railway, Koyeb, Fly, VPS).

import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { default as makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { encodeSession } from './lib/sessionId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT             = parseInt(process.env.PORT || '3000', 10);
const HOST             = process.env.HOST || '0.0.0.0';
const BRAND            = process.env.BRAND_NAME || 'EMPIRE BOT-WAN';
const PAIR_TIMEOUT_MS  = parseInt(process.env.PAIR_TIMEOUT_MS || '300000', 10); // 5 min
const RATE_LIMIT       = parseInt(process.env.RATE_LIMIT_PER_HOUR || '20', 10);
const SESSIONS_DIR     = './sessions';

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// In-memory map: phone -> { code, formatted, status, sock, sessionPath, sessionId, createdAt }
const pending = new Map();

// ============================================================
//  EXPRESS APP
// ============================================================
const app = express();
app.use(express.json());
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));

// Per-IP rate limit on the pairing endpoint
const pairLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,           // 1 hour
  max: RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many pairing requests from this IP. Try again later.' },
});

// ============================================================
//  HELPERS
// ============================================================
function normalizePhone(input) {
  return String(input || '').replace(/\D/g, '');
}

function cleanupEntry(phone) {
  const entry = pending.get(phone);
  if (!entry) return;
  try { entry.sock?.end?.(); } catch {}
  if (entry.sessionPath && fs.existsSync(entry.sessionPath)) {
    fs.rmSync(entry.sessionPath, { recursive: true, force: true });
  }
  pending.delete(phone);
}

// ============================================================
//  ROUTES
// ============================================================

// POST /api/pair — request a pairing code for a number
app.post('/api/pair', pairLimiter, async (req, res) => {
  const phone = normalizePhone(req.body?.phone);

  if (!phone || phone.length < 8 || phone.length > 15) {
    return res.status(400).json({ ok: false, error: 'Invalid phone number. Use international format (e.g. 2348012345678).' });
  }

  // Re-serve existing code if still awaiting
  const existing = pending.get(phone);
  if (existing && existing.status === 'awaiting') {
    return res.json({ ok: true, code: existing.code, formatted: existing.formatted, phone });
  }

  // Wipe any stale folder
  const sessionPath = path.join(SESSIONS_DIR, phone);
  if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      browser: [BRAND, 'Chrome', '120.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    // Wait briefly for socket to come up before requesting code
    await new Promise(r => setTimeout(r, 3000));

    const code = await sock.requestPairingCode(phone);
    const formatted = code.match(/.{1,4}/g)?.join('-') || code;

    const entry = {
      code, formatted,
      status: 'awaiting',
      sock, sessionPath,
      sessionId: null,
      createdAt: Date.now(),
    };
    pending.set(phone, entry);

    // Listen for successful link
    sock.ev.on('connection.update', (u) => {
      if (u.connection === 'open') {
        try {
          const sessionId = encodeSession(sessionPath);
          entry.sessionId = sessionId;
          entry.status = 'ready';
          console.log('🎉 Pairing complete for ' + phone);

          // Disconnect portal-side socket so the user's host can take over cleanly
          setTimeout(() => { try { sock.end(); } catch {} }, 2000);
        } catch (e) {
          console.error('encode failed:', e.message);
          entry.status = 'error';
          entry.errorMessage = e.message;
        }
      }
      if (u.connection === 'close' && entry.status === 'awaiting') {
        entry.status = 'expired';
      }
    });

    // Auto-expire
    setTimeout(() => {
      const e = pending.get(phone);
      if (e && e.status === 'awaiting') {
        e.status = 'expired';
        cleanupEntry(phone);
      }
    }, PAIR_TIMEOUT_MS);

    res.json({ ok: true, code, formatted, phone });
  } catch (e) {
    console.error('pair api error:', e.message);
    cleanupEntry(phone);
    res.status(500).json({ ok: false, error: 'Could not generate pairing code. Try again in a minute.' });
  }
});

// GET /api/status/:phone — poll for session ID
app.get('/api/status/:phone', (req, res) => {
  const phone = normalizePhone(req.params.phone);
  const entry = pending.get(phone);
  if (!entry) return res.status(404).json({ ok: false, error: 'No pending pairing for this number.' });

  res.json({
    ok: true,
    status: entry.status,
    sessionId: entry.status === 'ready' ? entry.sessionId : null,
    error: entry.errorMessage || null,
  });
});

// POST /api/done/:phone — client confirms it has the session ID; server cleans up
app.post('/api/done/:phone', (req, res) => {
  const phone = normalizePhone(req.params.phone);
  cleanupEntry(phone);
  res.json({ ok: true });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, brand: BRAND, pending: pending.size, uptime: process.uptime() });
});

// ============================================================
//  BOOT
// ============================================================
app.listen(PORT, HOST, () => {
  console.log('🌐 ' + BRAND + ' pairing portal running on http://' + HOST + ':' + PORT);
  console.log('   Rate limit: ' + RATE_LIMIT + ' requests/IP/hour');
  console.log('   Pair timeout: ' + (PAIR_TIMEOUT_MS / 1000) + 's');
});

// Graceful shutdown
function shutdown() {
  console.log('🛑 Shutting down — cleaning ' + pending.size + ' pending pairings...');
  for (const phone of pending.keys()) cleanupEntry(phone);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('uncaughtException', (e) => console.error('🔥 uncaught:', e?.message || e));
process.on('unhandledRejection', (e) => console.error('🔥 unhandled:', e?.message || e));
