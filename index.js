// Entrypoint pour Vercel (root index.js)
// Re-exporte le handler serverless depuis api/index.js
const handler = require('./api/index');

// Pour CommonJS
module.exports = handler;
// Pour compatibilité ESM
module.exports.default = handler;
