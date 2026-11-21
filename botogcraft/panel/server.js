// Panou de control OGCraft: salvează tokenul în bot/.env și pornește / oprește / repornește botul.
// Servește site-ul (site/index.html); butonul Create bot din el vorbește cu acest server.
// Rulează local (127.0.0.1), fără dependențe. Pornire: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const HOST = process.env.PANEL_HOST || '127.0.0.1';
const PORT = Number(process.env.PANEL_PORT) || 3000;
const BOT_DIR = path.join(__dirname, '..', 'bot');
const ENV_FILE = path.join(BOT_DIR, '.env');
const PASS_FILE = path.join(__dirname, '.panel-password');
const PERMISSIONS = '1099511720960'; // Manage Messages, Moderate Members, Send Messages etc.

// ---------- Cont și parolă panou ----------
const ACCOUNT_FILE = path.join(__dirname, '.panel-account.json');
let ACCOUNT = null;
try { ACCOUNT = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8')); } catch (e) {}
let PASSWORD = process.env.PANEL_PASSWORD;
if (!PASSWORD && !ACCOUNT) {
  try { PASSWORD = fs.readFileSync(PASS_FILE, 'utf8').trim(); } catch (e) {}
  if (!PASSWORD) {
    PASSWORD = crypto.randomBytes(12).toString('hex');
    fs.writeFileSync(PASS_FILE, PASSWORD, { mode: 0o600 });
  }
}

function hashPassword(password, salt) {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash };
}

function checkPanelKey(key) {
  if (ACCOUNT) {
    const expected = Buffer.from(ACCOUNT.passwordHash, 'hex');
    const actual = Buffer.from(crypto.scryptSync(String(key), ACCOUNT.passwordSalt, 64));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }
  const x = Buffer.from(String(key));
  const y = Buffer.from(String(PASSWORD));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function createAccount(email, password) {
  const credentials = hashPassword(password);
  ACCOUNT = { email: email.trim().toLowerCase(), passwordSalt: credentials.salt, passwordHash: credentials.hash };
  fs.writeFileSync(ACCOUNT_FILE, JSON.stringify(ACCOUNT), { mode: 0o600 });
}

// ---------- bot/.env ----------
function readEnv() {
  const out = {};
  let text = '';
  try { text = fs.readFileSync(ENV_FILE, 'utf8'); } catch (e) {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeEnv(updates) {
  let text;
  try { text = fs.readFileSync(ENV_FILE, 'utf8'); }
  catch (e) { try { text = fs.readFileSync(ENV_FILE + '.example', 'utf8'); } catch (e2) { text = ''; } }
  const lines = text.split(/\r?\n/);
  for (const [k, v] of Object.entries(updates)) {
    const val = String(v).replace(/[\r\n]/g, '');
    const i = lines.findIndex((l) => new RegExp('^\\s*' + k + '\\s*=').test(l));
    if (i >= 0) lines[i] = k + '=' + val; else lines.push(k + '=' + val);
  }
  fs.writeFileSync(ENV_FILE, lines.join('\n'), { mode: 0o600 });
}

// ---------- Controlul botului ----------
let child = null;
let startedAt = null;
let botName = null;
const logs = [];
const MC_IP = process.env.MC_SERVER || 'mc.ogcraft-rpg.com';
let minecraftStatus = {
  ip: MC_IP,
  online: null,
  players: null,
  maxPlayers: null,
  version: null,
  motd: null,
  checkedAt: null,
  error: null,
};

async function refreshMinecraftStatus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.mcsrvstat.us/3/' + encodeURIComponent(MC_IP), { signal: controller.signal });
    if (!response.ok) throw new Error('Status API HTTP ' + response.status);
    const data = await response.json();
    minecraftStatus = {
      ip: MC_IP,
      online: data.online === true,
      players: data.players?.online ?? 0,
      maxPlayers: data.players?.max ?? null,
      version: data.version || null,
      motd: data.motd?.clean?.join(' ') || null,
      checkedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    minecraftStatus = {
      ip: MC_IP,
      online: false,
      players: 0,
      maxPlayers: null,
      version: null,
      motd: null,
      checkedAt: new Date().toISOString(),
      error: error.name === 'AbortError' ? 'Verificarea a expirat.' : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
  return minecraftStatus;
}

refreshMinecraftStatus();
setInterval(refreshMinecraftStatus, 5 * 60 * 1000);

function log(text) {
  const token = readEnv().DISCORD_TOKEN;
  for (let line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (token && token.length > 20) line = line.split(token).join('***'); // tokenul nu apare în loguri
    logs.push(line);
  }
  while (logs.length > 300) logs.shift();
}

function startBot() {
  if (child) return 'Botul rulează deja.';
  const env = readEnv();
  if (!(env.DISCORD_TOKEN && env.DISCORD_TOKEN.length > 30)) return 'Salvează întâi tokenul.';
  if (!fs.existsSync(path.join(BOT_DIR, 'node_modules'))) return 'Lipsesc dependențele botului: rulează npm install în folderul bot.';
  child = spawn(process.execPath, ['index.js'], { cwd: BOT_DIR, stdio: ['ignore', 'pipe', 'pipe'] });
  startedAt = Date.now();
  log('[panel] pornesc botul...');
  child.stdout.on('data', (d) => log(d));
  child.stderr.on('data', (d) => log(d));
  child.on('error', (e) => log('[panel] eroare: ' + e.message));
  child.on('exit', (code, sig) => {
    log('[panel] botul s-a oprit (' + (sig || 'cod ' + code) + ')');
    child = null;
    startedAt = null;
  });
  return null;
}

function stopBot() {
  return new Promise((resolve) => {
    if (!child) return resolve(false);
    const c = child;
    const t = setTimeout(() => c.kill('SIGKILL'), 5000);
    c.once('exit', () => { clearTimeout(t); resolve(true); });
    c.kill();
  });
}

async function verifyToken(token) {
  const r = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
    headers: { Authorization: 'Bot ' + token },
  });
  return r.ok ? r.json() : null;
}

function status() {
  const env = readEnv();
  const clientId = /^\d{15,25}$/.test(env.CLIENT_ID || '') ? env.CLIENT_ID : null;
  return {
    running: !!child,
    uptime: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
    tokenSet: !!(env.DISCORD_TOKEN && env.DISCORD_TOKEN.length > 30), // tokenul nu e trimis niciodată în browser
    name: botName,
    clientId,
    invite: clientId
      ? 'https://discord.com/oauth2/authorize?client_id=' + clientId + '&permissions=' + PERMISSIONS + '&scope=bot+applications.commands'
      : null,
    discord: {
      online: !!child,
      uptimeSeconds: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0,
      name: botName,
    },
    minecraft: minecraftStatus,
    checkedAt: new Date().toISOString(),
    logs: logs.slice(-200),
  };
}

// ---------- Server HTTP ----------
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 10000) { reject(new Error('Cerere prea mare.')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(new Error('JSON invalid.')); } });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

  // Protecție împotriva DNS rebinding când panoul rulează doar local
  if (HOST === '127.0.0.1' && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return send(403, { error: 'Host nepermis.' });

  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/public-status') {
    const env = readEnv();
    return send(200, {
      discord: { online: !!child, uptimeSeconds: startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0, configured: !!(env.DISCORD_TOKEN && env.DISCORD_TOKEN.length > 30) },
      minecraft: minecraftStatus,
      checkedAt: new Date().toISOString(),
    });
  }
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, '..', 'site', 'index.html')));
  }
  if (!url.pathname.startsWith('/api/')) { res.writeHead(404); return res.end('Not found'); }

  const isRegister = req.method === 'POST' && url.pathname === '/api/register';
  if (!isRegister && !checkPanelKey(req.headers['x-panel-key'] || '')) return send(401, { error: 'Parolă greșită.' });

  try {
    const route = req.method + ' ' + url.pathname;
    if (route === 'GET /api/status') return send(200, status());

    if (route === 'POST /api/register') {
      const body = await readJson(req);
      const email = String(body.email || '').trim();
      const password = String(body.password || '');
      const token = String(body.token || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(400, { error: 'Email invalid.' });
      if (password.length < 6) return send(400, { error: 'Parola trebuie să aibă cel puțin 6 caractere.' });
      if (token.length < 30 || /\s/.test(token)) return send(400, { error: 'Tokenul Bot Discord nu arată corect. Ia-l din Developer Portal → aplicația ta → Bot → Reset Token.' });
      let app;
      try { app = await verifyToken(token); }
      catch (e) { return send(502, { error: 'Nu m-am putut conecta la Discord. Verifică internetul.' }); }
      if (!app) return send(400, { error: 'Token Discord invalid.' });
      createAccount(email, password);
      writeEnv({ DISCORD_TOKEN: token, CLIENT_ID: app.id });
      botName = app.name;
      return send(200, { ok: true, name: app.name, clientId: app.id });
    }

    if (route === 'POST /api/token') {
      const token = String((await readJson(req)).token || '').trim();
      if (token.length < 30 || /\s/.test(token)) return send(400, { error: 'Tokenul nu arată corect.' });
      let app;
      try { app = await verifyToken(token); }
      catch (e) { return send(502, { error: 'Nu m-am putut conecta la Discord. Verifică internetul.' }); }
      if (!app) return send(400, { error: 'Token invalid. Ia-l din Developer Portal → Bot → Reset Token.' });
      writeEnv({ DISCORD_TOKEN: token, CLIENT_ID: app.id });
      botName = app.name;
      if (child) log('[panel] Token schimbat: repornește botul.');
      return send(200, { ok: true, name: app.name, clientId: app.id });
    }

    if (route === 'POST /api/start') {
      const err = startBot();
      return err ? send(400, { error: err }) : send(200, { ok: true });
    }
    if (route === 'POST /api/stop') { await stopBot(); return send(200, { ok: true }); }
    if (route === 'POST /api/restart') {
      await stopBot();
      const err = startBot();
      return err ? send(400, { error: err }) : send(200, { ok: true });
    }
    return send(404, { error: 'Necunoscut.' });
  } catch (e) {
    return send(500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log('Panou OGCraft: http://localhost:' + PORT);
  if (!ACCOUNT && PASSWORD) console.log('Parola panoului: ' + PASSWORD);
  if (HOST !== '127.0.0.1') console.log('ATENȚIE: panoul este expus în rețea. Folosește o parolă puternică și HTTPS.');
});

async function shutdown() { await stopBot(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
