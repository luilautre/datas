// api/index.js
const express = require('express');

const app = express();
app.use(express.json());
// Vercel est devant un proxy : nécessaire pour récupérer la vraie IP du client
app.set('trust proxy', true);

// --- Configuration Supabase (intégration Vercel) ---
// Le code lit les variables auto-injectées par l'intégration Supabase de Vercel :
//   NEXT_PUBLIC_SUPABASE_URL   -> https://xxxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  -> clé service_role (secrète, insertion côté serveur)
// (fallbacks : SUPABASE_URL / SUPABASE_SERVICE_ROLE)
function supabaseConfig() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  return { baseUrl, serviceRoleKey };
}

// Schéma de la table `todos` (mis en cache après le premier appel)
let _todosCols = null;
async function getTodosColumns() {
  if (_todosCols) return _todosCols;
  const { baseUrl, serviceRoleKey } = supabaseConfig();
  const H = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  try {
    const r = await fetch(`${baseUrl}/rest/v1/`, { headers: H });
    const spec = await r.json();
    const props = spec?.definitions?.todos?.properties || {};
    _todosCols = Object.keys(props);
  } catch {
    _todosCols = []; // schéma indisponible -> on utilisera le fallback
  }
  return _todosCols;
}

// Construit le corps d'insertion selon les colonnes réelles de `todos`
async function insertClick(record) {
  const { baseUrl, serviceRoleKey } = supabaseConfig();
  const H = {
    'Content-Type': 'application/json',
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Prefer: 'return=minimal',
  };

  const cols = await getTodosColumns();
  const body = {};
  // Colonne dédiée présente ? On l'utilise directement.
  const dedicated = ['source', 'nom', 'user_agent', 'referer', 'ip', 'accept_language', 'host'];
  for (const c of dedicated) {
    if (cols.includes(c) && record[c] != null) body[c] = record[c];
  }

  // Sinon, on stocke tout en JSON dans une colonne texte (task par défaut).
  if (Object.keys(body).length === 0) {
    const textCol =
      cols.find((c) => ['task', 'texte', 'content', 'description', 'titre'].includes(c)) ||
      cols[0] ||
      'task';
    body[textCol] = JSON.stringify(record);
  }

  const res = await fetch(`${baseUrl}/rest/v1/todos`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Supabase insert HTTP ${res.status}: ${await res.text()}`);
  }
}

// --- Mapping des destinations de redirection ---
const REDIRECTS = {
  '/test': 'https://luilautre.github.io',
  // '/autre': 'https://example.com',
};
const DEFAULT_REDIRECT = 'https://luilautre.github.io';

// --- Routes existantes ---
app.get('/', (req, res) => {
  res.json({ message: 'Express on Vercel' });
});

app.get('/hello/:name', (req, res) => {
  res.json({ hello: req.params.name });
});

// --- Endpoint /tables ---
// GET /tables -> liste les tables disponibles dans le schéma Supabase
app.get('/tables', async (req, res) => {
  const { baseUrl, serviceRoleKey } = supabaseConfig();
  try {
    const r = await fetch(`${baseUrl}/rest/v1/`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
    const spec = await r.json();
    res.json({
      topKeys: Object.keys(spec),
      paths: Object.keys(spec.paths || {}),
      definitions: Object.keys(spec.definitions || {}),
      schemas: Object.keys(spec.components?.schemas || {}),
      swagger: spec.swagger || null,
      openapi: spec.openapi || null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Endpoint /data ---
// GET /data?key=SECRET -> IP complète. Sans clé -> IP tronquée.
function truncateIp(ip) {
  if (!ip) return ip;
  const v4 = ip.split('.');
  if (v4.length === 4) return v4.slice(0, 3).join('.') + '.0';
  if (ip.includes(':')) {
    const g = ip.split(':');
    return g.slice(0, 4).join(':') + '::';
  }
  return ip;
}
app.get('/data', async (req, res) => {
  const { baseUrl, serviceRoleKey } = supabaseConfig();
  const H = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const cols = await getTodosColumns();
  const select = (cols.length ? cols : ['*']).join(',');
  const authToken = process.env.DATA_TOKEN;
  const provided = (req.query.key || req.headers['x-data-key'] || '').toString();
  const authenticated = !!(authToken && provided && provided === authToken);
  try {
    const r = await fetch(`${baseUrl}/rest/v1/todos?select=${encodeURIComponent(select)}&limit=50&order=id.desc`, { headers: H });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    let rows = await r.json();
    if (!authenticated && Array.isArray(rows)) {
      rows = rows.map((row) => (row && row.ip ? { ...row, ip: truncateIp(row.ip) } : row));
    }
    res.json({ authenticated, count: Array.isArray(rows) ? rows.length : 0, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Endpoint /exel ---
// GET /exel?key=SECRET -> télécharge un fichier .xlsx (IP complète sans clé, tronquée sans)
app.get('/exel', async (req, res) => {
  const { baseUrl, serviceRoleKey } = supabaseConfig();
  const H = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const cols = await getTodosColumns();
  const select = (cols.length ? cols : ['*']).join(',');
  const authToken = process.env.DATA_TOKEN;
  const provided = (req.query.key || req.headers['x-data-key'] || '').toString();
  const authenticated = !!(authToken && provided && provided === authToken);
  try {
    const r = await fetch(`${baseUrl}/rest/v1/todos?select=${encodeURIComponent(select)}&limit=1000&order=id.desc`, { headers: H });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });
    let rows = await r.json();
    if (!authenticated && Array.isArray(rows)) {
      rows = rows.map((row) => (row && row.ip ? { ...row, ip: truncateIp(row.ip) } : row));
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'todos');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="todos.xlsx"');
    return res.send(Buffer.from(buf));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Endpoint /test ---
// GET /test?source=xx&nom=xx
//   1. enregistre { source, nom } dans la table `todos` (Supabase)
//   2. redirige (HTTP 302) vers l'URL fixe configurée pour /test
app.get('/test', async (req, res) => {
  const h = req.headers;
  // Toutes les données de tracking légalement stockables
  const record = {
    source: (req.query.source || '').toString().slice(0, 200),
    nom: (req.query.nom || '').toString().slice(0, 200),
    user_agent: (h['user-agent'] || '').toString().slice(0, 500),
    referer: (h['referer'] || h['referrer'] || '').toString().slice(0, 500),
    ip: ((h['x-forwarded-for'] || '').toString().split(',')[0].trim() || req.ip || '').slice(0, 64),
    accept_language: (h['accept-language'] || '').toString().slice(0, 200),
    host: (h['host'] || '').toString().slice(0, 200),
  };

  // Enregistrement en base (non bloquant : on redirige même si la BdD plante)
  try {
    await insertClick(record);
  } catch (err) {
    console.error('Supabase insert failed:', err.message);
  }

  const target = REDIRECTS['/test'] || DEFAULT_REDIRECT;
  return res.redirect(302, target);
});

// IMPORTANT : ne pas appeler app.listen() ici
module.exports = app;
