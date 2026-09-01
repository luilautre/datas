// api/index.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Client Supabase créé paresseusement (pour ne pas planter l'import en local sans .env)
// Variables d'environnement à définir dans Vercel :
//   SUPABASE_URL          -> https://xxxxx.supabase.co
//   SUPABASE_SERVICE_ROLE -> clé service_role (secrète, insertion côté serveur)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
  }
  return _supabase;
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
    await getSupabase()
      .from('clicks')
      .insert({ source, nom });
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
