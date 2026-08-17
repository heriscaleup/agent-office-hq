import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { KEYWORDS_AUDIT_DATA, getAuditSummary } from './serp_auditor.mjs';
import { processAgentChat, AGENT_KNOWLEDGE } from './agent_brain.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3333;
const ROOT = __dirname;
const MASTER_PASSWORD = process.env.HQ_PASSWORD || 'Metr0Land';
const AUTH_SECRET = process.env.HQ_AUTH_SECRET || 'tepatlaser-ironman-cyber-secret-key-2026';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Token utilities
function generateToken(payload = {}) {
  const data = JSON.stringify({ ...payload, timestamp: Date.now() });
  const dataB64 = Buffer.from(data).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(dataB64).digest('base64url');
  return `${dataB64}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [dataB64, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(dataB64).digest('base64url');
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    try {
      const decoded = JSON.parse(Buffer.from(dataB64, 'base64url').toString('utf8'));
      // Valid for 30 days
      if (Date.now() - decoded.timestamp < 30 * 24 * 60 * 60 * 1000) {
        return decoded;
      }
    } catch (e) {
      return false;
    }
  }
  return false;
}

function getRequestToken(req) {
  // 1. Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Check cookie header
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('hq_session_token='));
    if (authCookie) {
      return authCookie.split('=')[1];
    }
  }

  return null;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let reqPath = parsedUrl.pathname;

  // Global Security & CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Auth Endpoint: Login
  if (reqPath === '/api/auth/login' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const passwordInput = (body.password || '').trim();

    if (passwordInput === MASTER_PASSWORD) {
      const token = generateToken({ role: 'admin', user: 'boss' });
      res.setHeader('Set-Cookie', `hq_session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'success',
        token: token,
        message: 'ACCESS GRANTED: WELCOME TO SWARM HQ'
      }));
      return;
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'error',
        message: 'ACCESS DENIED: INVALID PASSCODE'
      }));
      return;
    }
  }

  // 2. Auth Endpoint: Verify Token
  if (reqPath === '/api/auth/verify') {
    const token = getRequestToken(req);
    const session = verifyToken(token);
    if (session) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'success', authenticated: true, user: session.user }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: 'error', authenticated: false, message: 'UNAUTHORIZED' }));
    }
    return;
  }

  // Protected API Endpoints Guard
  if (reqPath.startsWith('/api/')) {
    const token = getRequestToken(req);
    const session = verifyToken(token);
    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'error',
        message: 'UNAUTHORIZED: SECURITY PASSCODE REQUIRED'
      }));
      return;
    }

    // Interactive Agent Chat & Interrogation API
    if (reqPath === '/api/agent/chat' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const agentId = body.agentId;
      const message = (body.message || '').trim();
      const history = body.history || [];

      if (!agentId || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'error', message: 'agentId dan message wajib diisi.' }));
        return;
      }

      const chatResult = processAgentChat(agentId, message, history);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(chatResult, null, 2));
      return;
    }

    if (reqPath === '/api/serp-audit') {
      const summary = getAuditSummary();
      const responseData = {
        status: 'success',
        timestamp: summary.lastAuditTimestamp,
        summary: summary,
        keywords: KEYWORDS_AUDIT_DATA
      };
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(responseData, null, 2));
      return;
    }

    if (reqPath === '/api/system-status') {
      const statusData = {
        status: 'ONLINE',
        vps: '163.61.44.41: OK',
        fleet: ['tepatlaser.com', 'rajacuttinglaser.com', 'jasalasercutting.com'],
        uptime: process.uptime()
      };
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(statusData, null, 2));
      return;
    }
  }

  // 3. Static files serving with strict Path Traversal Protection
  if (reqPath === '/') reqPath = '/index.html';
  
  // Sanitize path against directory traversal
  const safeReqPath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.resolve(ROOT, '.' + safeReqPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Path Traversal Blocked');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 TepatLaser AI Swarm HQ & Interrogation Engine is live on: http://localhost:${PORT}`);
});
