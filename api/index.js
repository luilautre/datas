// api/index.js
const express = require('express');

const app = express();
app.use(express.json());

// --- Configuration Supabase (intégration Vercel) ---
// Le code lit les variables auto-injectées par l'intégration Supabase de Vercel :
//   NEXT_PUBLIC_SUPABASE_URL   -> https://xxxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  -> clé service_role (secrète, insertion côté serveur)
// (fallbacks : SUPABASE_URL / SUPABASE_SERVICE_ROLE si tu préfères les tiennes)
function supabaseConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), serviceRoleKey };
}

// Insertion directe via l'API REST PostgREST (fetch natif, pas de WebSocket)
async function insertClick(source, nom) {
  const { baseUrl, serviceRoleKey } = supabaseConfig();
  const res = await fetch(`${baseUrl}/rest/v1/clicks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ source, nom }),
  });
  if (!res.ok) {
    throw new Error(`Supabase insert HTTP ${res.status}: ${await res.text()}`);
  }
}

// --- Mapping des destinations de redirection ---
// Chaque chemin -> URL fixe vers laquelle rediriger après enregistrement.
const REDIRECTS = {
  '/test': 'https://luilautre.github.io',
  // ajoute d'autres routes ici si besoin :
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
//   1. enregistre { source, nom } dans la table `clicks` (Supabase)
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

  // Redirection 3xx (302) vers la destination fixe
  const target = REDIRECTS['/test'] || DEFAULT_REDIRECT;
  return res.redirect(302, target);
});

// IMPORTANT : ne pas appeler app.listen() ici
// On exporte l'instance d'application pour Vercel
module.exports = app;
