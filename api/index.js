// api/index.js
const express = require('express');

const app = express();

// Middleware JSON (optionnel mais très utile)
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Express on Vercel' });
});

app.get('/hello/:name', (req, res) => {
  res.json({ hello: req.params.name });
});

// IMPORTANT : ne pas appeler app.listen() ici
// On exporte l’instance d’application pour Vercel
module.exports = app;
