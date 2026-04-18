#!/usr/bin/env node
/**
 * serve.js — NEXUS local HTTPS server
 *
 * Generates a self-signed TLS cert for localhost on first run.
 * No npm install required — pure Node.js built-ins only.
 *
 * Usage:
 *   node serve.js
 *
 * Then open: https://localhost:8443
 * Click "Advanced → Proceed to localhost" on the browser warning.
 * Camera permissions will then work normally.
 */

'use strict';

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const os     = require('os');
const { spawnSync, execSync } = require('child_process');

const PORT      = 8443;
const HTTP_PORT = 8080;
const CERT_DIR  = path.join(__dirname, '.cert');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE  = path.join(CERT_DIR, 'key.pem');
const SERVE_DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

// ═══════════════════════════════════════════
// CERTIFICATE — tries openssl, mkcert, then
// auto-installs the 'selfsigned' npm package
// ═══════════════════════════════════════════
function ensureCert() {
  if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });
  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    console.log('✓ Existing certificate found');
    return;
  }
  console.log('⚙  Generating self-signed certificate...\n');
  if (tryOpenSSL())    return;
  if (tryMkcert())     return;
  if (trySelfSigned()) return;
  console.error('\n✗ Could not generate a certificate.');
  console.error('  Install openssl or run: npm install -g mkcert');
  process.exit(1);
}

function tryOpenSSL() {
  const base = [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', KEY_FILE, '-out', CERT_FILE,
    '-days', '730', '-nodes', '-subj', '/CN=localhost',
  ];
  // Try with SAN extension first
  let r = spawnSync('openssl', [...base, '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], { stdio: 'pipe' });
  if (r.status === 0) { console.log('✓ openssl (with SAN)'); return true; }
  // Retry without -addext (older OpenSSL)
  r = spawnSync('openssl', base, { stdio: 'pipe' });
  if (r.status === 0) { console.log('✓ openssl'); return true; }
  console.log('  openssl not found, trying next...');
  return false;
}

function tryMkcert() {
  try {
    const v = spawnSync('mkcert', ['-version'], { stdio: 'pipe' });
    if (v.status !== 0) return false;
    const r = spawnSync('mkcert', ['-key-file', KEY_FILE, '-cert-file', CERT_FILE, 'localhost', '127.0.0.1'], { stdio: 'inherit' });
    if (r.status === 0) { console.log('✓ mkcert (browser-trusted)'); return true; }
  } catch (_) {}
  return false;
}

function trySelfSigned() {
  const nmPath = path.join(__dirname, 'node_modules', 'selfsigned');
  if (!fs.existsSync(nmPath)) {
    console.log('  Installing "selfsigned" npm package (one-time, ~200KB)...');
    try {
      execSync('npm install selfsigned --no-save --no-audit --no-fund', { cwd: __dirname, stdio: 'pipe' });
    } catch (e) {
      console.log('  npm install failed:', e.message);
      return false;
    }
  }
  try {
    const selfsigned = require('selfsigned');
    const pems = selfsigned.generate(
      [{ name: 'commonName', value: 'localhost' }],
      {
        days: 730, algorithm: 'sha256',
        extensions: [{
          name: 'subjectAltName',
          altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }],
        }],
      }
    );
    fs.writeFileSync(KEY_FILE,  pems.private);
    fs.writeFileSync(CERT_FILE, pems.cert);
    console.log('✓ selfsigned npm package');
    return true;
  } catch (e) {
    console.log('  selfsigned failed:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════
// FILE SERVER
// ═══════════════════════════════════════════
function requestHandler(req, res) {
  let urlPath = req.url.split('?')[0];
  try { urlPath = decodeURIComponent(urlPath); } catch (_) {}
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.normalize(path.join(SERVE_DIR, urlPath));
  if (!filePath.startsWith(SERVE_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
      res.end(err.code === 'ENOENT' ? `404: ${urlPath}` : 'Server error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type':                  MIME[ext] || 'application/octet-stream',
      'Cache-Control':                 'no-cache',
      'Cross-Origin-Opener-Policy':    'same-origin',
      'Cross-Origin-Embedder-Policy':  'require-corp',
    });
    res.end(data);
  });
}

// ═══════════════════════════════════════════
// START
// ═══════════════════════════════════════════
function start() {
  ensureCert();

  const key  = fs.readFileSync(KEY_FILE);
  const cert = fs.readFileSync(CERT_FILE);

  const httpsServer = https.createServer({ key, cert }, requestHandler);
  httpsServer.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n✗ Port ${PORT} already in use. Edit PORT in serve.js`);
    } else {
      console.error('\n✗ HTTPS error:', e.message);
    }
    process.exit(1);
  });

  httpsServer.listen(PORT, '0.0.0.0', () => {
    // HTTP redirect (non-critical)
    http.createServer((req, res) => {
      res.writeHead(301, { Location: `https://localhost:${PORT}${req.url}` });
      res.end();
    }).listen(HTTP_PORT, () => printBanner());
  });
}

function printBanner() {
  const p = os.platform();
  const hint =
    p === 'darwin' ? '"Show Details" → "visit this website"' :
    p === 'win32'  ? '"Advanced" → "Proceed to localhost (unsafe)"' :
                     '"Advanced" → "Proceed to localhost"';

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║        NEXUS  —  Local HTTPS Server          ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║   👉  https://localhost:${PORT}               ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  ⚠  Browser will show a security warning     ║');
  console.log(`║  → ${hint.padEnd(42)}║`);
  console.log('║  This is safe — cert is localhost-only.      ║');
  console.log('║  Camera works after you accept.              ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  http://localhost:${HTTP_PORT}  →  redirects to HTTPS  ║`);
  console.log('║  Press Ctrl+C to stop                        ║');
  console.log('╚══════════════════════════════════════════════╝\n');
}

start();
