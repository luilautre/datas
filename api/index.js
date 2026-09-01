const serverless = require('serverless-http');
const express = require('express');
const app = express();

// Middleware example (optionnel)
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Salut — Express sur Vercel !');
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Express + Vercel' });
});

// Export as a serverless handler for Vercel
module.exports = serverless(app);
