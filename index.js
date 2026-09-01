// Entrypoint pour Vercel (root index.js)
// Import explicite d'Express pour que Vercel détecte l'usage d'Express
// (On n'utilise pas directement l'objet ici — c'est juste pour la détection)
require('express');

const handler = require('./api/index');

// Exporte le handler serverless pour Vercel
module.exports = handler;
module.exports.default = handler;
