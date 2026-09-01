# datas

API Express déployée sur Vercel. Endpoint `/test` qui enregistre
`source` + `nom` dans Supabase puis redirige (HTTP 302) vers une URL fixe.

## Endpoint

```
GET https://ll-links.vercel.app/test?source=xx&nom=xx
```

1. insère `{ source, nom }` dans la table `clicks` (Supabase)
2. redirige (302) vers `https://luilautre.github.io`

## Mise en place (une seule fois)

### 1. Créer le projet Supabase

- Aller sur https://supabase.com → **Sign in** (connexion GitHub possible)
- **New project** → nommer, choisir une région, créer
- Une fois prêt, ouvrir **Project Settings → API** et récupérer :
  - `Project URL` (ex. `https://xxxxx.supabase.co`)
  - `service_role` key (secrète — ne jamais exposer côté client)

### 2. Créer la table `clicks`

Dans **SQL Editor** de Supabase, exécuter :

```sql
create table if not exists clicks (
  id        bigint generated always as identity primary key,
  source    text,
  nom       text,
  created_at timestamptz not null default now()
);

-- La clé service_role contourne déjà la RLS (Row Level Security).
-- Optionnel : activer la lecture publique anonyme pour consultation :
-- alter table clicks enable row level security;
-- create policy "select public" on clicks for select using (true);
```

### 3. Configurer les variables d'environnement sur Vercel

Dans le projet Vercel `ll-links` :

**Settings → Environment Variables** → ajouter (tous les environnements) :

| Nom                   | Valeur                                  |
|-----------------------|-----------------------------------------|
| `SUPABASE_URL`        | `https://xxxxx.supabase.co`             |
| `SUPABASE_SERVICE_ROLE` | la clé `service_role` (secrète)        |

### 4. Déployer

Le projet Vercel est connecté au dépôt GitHub. Pousser le code déploie
automatiquement :

```bash
git add -A && git commit -m "endpoint /test + Supabase" && git push
```

## Configurer d'autres redirections

Le mapping des destinations est dans `api/index.js` (objet `REDIRECTS`) :

```js
const REDIRECTS = {
  '/test': 'https://luilautre.github.io',
  // '/autre': 'https://example.com',
};
```

## Développement local

```bash
npm install
# créer un fichier .env avec :
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE=...
npm run dev
```
