// lib/sessionId.js — Encode auth_info/ folder into a portable string.
// Used by the portal to ENCODE after a successful pairing,
// and by every forked bot to DECODE on startup.

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const PREFIX = process.env.SESSION_PREFIX || 'EMPIRE~';

export function encodeSession(folder) {
  if (!fs.existsSync(folder)) {
    throw new Error('Session folder not found: ' + folder);
  }

  const files = {};
  for (const name of fs.readdirSync(folder)) {
    const full = path.join(folder, name);
    if (fs.statSync(full).isFile()) {
      files[name] = fs.readFileSync(full, 'utf-8');
    }
  }

  const json = JSON.stringify(files);
  const compressed = zlib.gzipSync(json);
  return PREFIX + compressed.toString('base64');
}

export function decodeSession(sessionId, targetFolder) {
  if (!sessionId.startsWith(PREFIX)) {
    throw new Error('Invalid SESSION_ID prefix');
  }

  const b64 = sessionId.slice(PREFIX.length);
  const compressed = Buffer.from(b64, 'base64');
  const json = zlib.gunzipSync(compressed).toString('utf-8');
  const files = JSON.parse(json);

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(targetFolder, name), content, 'utf-8');
  }

  return Object.keys(files).length;
}

export function hasValidSessionId(id) {
  return typeof id === 'string' && id.startsWith(PREFIX) && id.length > 50;
}
