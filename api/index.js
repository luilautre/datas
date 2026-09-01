// api/index.js
const express = require('express');

const app = express();
app.use(express.json());

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
async function insertClick(source, nom) {
  const { baseUrl, serviceRoleKey } = supabaseConfig();
  const H = {
    'Content-Type': 'application/json',
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Prefer: 'return=minimal',
  };

  const cols = await getTodosColumns();
  const body = {};
  if (cols.includes('source')) body.source = source;
  if (cols.includes('nom')) body.nom = nom;

  // Si la table n'a pas de colonnes source/nom dédiées,
  // on stocke le tout en JSON dans une colonne texte (task par défaut).
  if (!body.source && !body.nom) {
    const textCol =
      cols.find((c) => ['task', 'texte', 'content', 'description', 'titre'].includes(c)) ||
      cols[0] ||
      'task';
    body[textCol] = JSON.stringify({ source, nom });
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

// --- Endpoint /test ---
// GET /test?source=xx&nom=xx
//   1. enregistre { source, nom } dans la table `todos` (Supabase)
//   2. redirige (HTTP 302) vers l'URL fixe configurée pour /test
app.get('/test', async (req, res) => {
  const source = (req.query.source || '').toString().slice(0, 200);
  const nom = (req.query.nom || '').toString().slice(0, 200);

  // Enregistrement en base (non bloquant : on redirige même si la BdD plante)
  try {
    await insertClick(source, nom);
  } catch (err) {
    console.error('Supabase insert failed:', err.message);
  }

  const target = REDIRECTS['/test'] || DEFAULT_REDIRECT;
  return res.redirect(302, target);
});

// IMPORTANT : ne pas appeler app.listen() ici
module.exports = app;
