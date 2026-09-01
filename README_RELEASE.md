Release: Express pour Vercel (branch: release/express-vercel)

Ce que j'ai ajouté (optionnel):
- package.json (dépendances express + serverless-http)
- api/index.js (Express app exportée via serverless-http pour Vercel)

Notes courtes:
- Déploiement Vercel: ce dossier "api/" expose une fonction serverless; Vercel l'utilisera automatiquement.
- Pour tester localement: installe les dépendances avec `npm install` puis `node api/index.js` (attention: ce n'est pas strictement identique au runtime serverless de Vercel).

Créer une release GitHub (optionnel, manuel):
- Via l'interface: Releases -> Draft new release -> Tag: v0.1.0 -> target: release/express-vercel
- Ou en CLI (si tu as gh):
  gh release create v0.1.0 --title "Express for Vercel" --notes "Release pour déployer Express sur Vercel" --target release/express-vercel

Modifs optionnelles que je peux faire si tu veux:
- Ajouter un fichier vercel.json pour configurer le runtime
- Transformer en route handler ES module
- Ajouter des tests ou d'autres endpoints

Dis-moi: je crée aussi la release GitHub pour toi (si tu veux), ou tu préfères que je fasse un vercel.json ?
