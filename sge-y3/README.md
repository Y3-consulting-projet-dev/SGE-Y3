# SGE-Y3 — Système de Gestion des Évaluations

## 1. Présentation

SGE-Y3 est l'outil d'auto-évaluation interne du cabinet **Ycube AC**. Il gère le
cycle annuel d'évaluation des collaborateurs : chaque personne remplit sa propre
auto-évaluation, sa hiérarchie (senior, manager) la complète, la RH valide et
calibre, puis les associés prennent les décisions finales (taux d'augmentation,
etc.). Tout ce cycle est rattaché à une "saison" appelée **cycle**
(ex : `Cycle 2026-2028`), qui a une date de début et une date de fin.

Ce document décrit l'état réel du projet et de sa conteneurisation Docker, pour
qu'un développeur qui découvre le projet puisse le faire tourner et s'y
retrouver rapidement.

## 2. La stack technique réelle

**Important** : à cause de l'historique du projet, une confusion revient
souvent — ce n'est **pas** une stack Flask/Vue. Voici ce qui est réellement
utilisé :

| Composant | Techno réelle | Ce que ce n'est PAS |
|---|---|---|
| Backend | **Express (Node.js)** — point d'entrée `backend/src/app.js` | Pas de Flask, pas de Python côté serveur |
| Frontend | **React 19 + Vite 8** | Pas de Vue.js |
| Base de données | **MongoDB**, via l'ODM **Mongoose** | Pas de driver Python (pymongo) |

Le backend démarre avec `node src/app.js` (script `npm start`) — il n'y a pas
de fichier WSGI, pas d'objet `app:app`. Le build du frontend se fait avec
`npm run build` (Vite), qui produit un dossier `dist/`.

## 3. Architecture Docker

L'application tourne dans **3 conteneurs** orchestrés par `docker-compose.yml`,
qui se parlent uniquement par leur **nom de service** (le réseau Docker créé
par Compose fait la résolution DNS) :

```
                    ┌─────────────────────────────────────────┐
                    │              Navigateur                 │
                    └───────────────────┬─────────────────────┘
                                        │  http://localhost:8080
                                        ▼
                    ┌────────────────────────────────────────────┐
                    │   frontend  (nginx:alpine)                 │
                    │   - sert les fichiers React buildés (dist) │
                    │   - / (SPA)        → index.html            │
                    │   - /api/*         → proxy vers backend    │
                    └───────────────────┬────────────────────────┘
                                        │  http://backend:5000
                                        ▼
                    ┌───────────────────────────────────────────┐
                    │   backend  (Node.js / Express)            │
                    │   - API REST sous /api/...                │
                    └───────────────────┬───────────────────────┘
                                        │  mongodb://mongo:27017
                                        ▼
                    ┌───────────────────────────────────────────┐
                    │   mongo  (MongoDB officiel, image mongo:7)│
                    │   - donnée persistée dans un volume Docker│
                    └───────────────────────────────────────────┘
```

Le rôle de **nginx** dans le conteneur `frontend` a deux facettes :
1. Il sert les fichiers statiques du build React (HTML/CSS/JS) — c'est un
   serveur de fichiers, comme n'importe quel serveur web.
2. Il fait aussi **office de proxy inverse** : toute requête vers `/api/...`
   n'est pas traitée par nginx lui-même, elle est transmise telle quelle au
   conteneur `backend`. Vu du navigateur, tout part du même domaine
   (`localhost:8080`) — pas de souci de CORS, pas d'IP à connaître côté
   frontend.

Seul le conteneur `frontend` est exposé à l'extérieur (port `8080`). `backend`
et `mongo` ne sont accessibles que depuis l'intérieur du réseau Docker, entre
conteneurs — pas depuis votre machine directement (voir section 8).

## 4. Structure des fichiers Docker

```
sge-y3/
├── docker-compose.yml        # Orchestre les 3 conteneurs
├── .env                      # Vos vraies valeurs (secrets) — jamais commité
├── .env.example               # Modèle à copier, sans secrets
├── .gitignore                 # Ignore .env à la racine
│
├── backend/
│   ├── Dockerfile              # Image du backend Express
│   ├── .dockerignore            # Exclut node_modules, .env, .git du build
│   └── src/app.js               # Point d'entrée réel de l'API
│
└── frontend/
    ├── Dockerfile              # Build multi-étapes (Node → nginx)
    ├── nginx.conf               # Config nginx : SPA + proxy /api
    ├── .dockerignore             # Exclut node_modules, dist, .git du build
    └── vite.config.js            # Contient aussi le proxy dev (voir §8)
```

**`backend/Dockerfile`** : image `node:20-alpine`, installe les dépendances de
production uniquement (`npm ci --omit=dev`), copie le code, expose le port
`5000` et lance `node src/app.js`. Pas de serveur applicatif supplémentaire
(type gunicorn côté Python) : Express est déjà le serveur de production, il
n'y a rien à ajouter par-dessus.

**`frontend/Dockerfile`** : build **multi-étapes**.
- Étape 1 (`node:20-alpine`) : installe les dépendances, lance `npm run build`
  → produit `dist/`.
- Étape 2 (`nginx:alpine`) : ne garde que le contenu de `dist/` et la config
  nginx. L'image finale ne contient ni Node, ni les sources, ni
  `node_modules` — juste des fichiers statiques et nginx.

**`frontend/nginx.conf`** : voir le détail du `proxy_pass` en section 8.

## 5. Démarrer le projet depuis zéro

**Prérequis** : Docker Desktop installé et lancé (le daemon doit être actif —
vérifiable avec `docker info`).

```bash
cd sge-y3

# 1. Créer votre fichier de variables d'environnement
cp .env.example .env

# 2. Générer un JWT_SECRET aléatoire et le coller dans .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# → copier la valeur affichée dans .env, à la place de JWT_SECRET=...

# 3. Construire les images
docker compose build

# 4. Démarrer les conteneurs (en arrière-plan)
docker compose up -d
```

Vérifier que ça tourne (`curl.exe` sous Windows/PowerShell — sur Mac/Linux,
utilisez simplement `curl`, sans `.exe`) :
```bash
curl.exe http://localhost:8080/api/health
# → {"status":"ok"}
```
Puis ouvrir `http://localhost:8080` dans le navigateur.

**Arrêter les conteneurs** :
```bash
docker compose down          # arrête et retire les conteneurs (le volume mongo-data est conservé)
docker compose down -v       # pareil, mais supprime aussi les données Mongo (destructif)
```

## 6. Variables d'environnement

Toutes se définissent dans `sge-y3/.env` (à côté de `docker-compose.yml`),
jamais dans le code.

| Variable | Obligatoire ? | Rôle |
|---|---|---|
| `JWT_SECRET` | **Oui** — le démarrage échoue sans elle (`JWT_SECRET est requis`) | Signe les jetons de connexion. Doit être une valeur longue et aléatoire. |
| `JWT_EXPIRES_IN` | Non (défaut `24h`) | Durée de validité d'un jeton de connexion. |
| `FRONTEND_URL` | Non (défaut `http://localhost:8080`) | Utilisée pour la config CORS et les liens dans les emails. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | **Non** — tous optionnels | Envoi d'emails (rappels, notifications). Si `SMTP_HOST` est vide, l'envoi est simplement ignoré (avec un avertissement dans les logs) — l'application fonctionne normalement sans. |

`MONGO_URI` et `PORT` ne sont **pas** à mettre dans `.env` : ils sont fixés
directement dans `docker-compose.yml` (`mongodb://mongo:27017/sge_y3` et
`5000`), car ce sont des détails internes à l'orchestration Docker, pas des
secrets.

⚠️ **Ne committez jamais de fichier `.env`** (ni à la racine `sge-y3/`, ni dans
`backend/`) — les secrets se transmettent en dehors de git (message, coffre
partagé, etc.). Le projet est déjà tombé dans ce piège une fois
(`backend/.env` et son `JWT_SECRET` ont été suivis par erreur avant d'être
nettoyés).

## 7. Opérations courantes

**Reconstruire après une modification de code** (le code est copié dans
l'image au moment du build — il ne se recharge pas tout seul) :
```bash
docker compose up -d --build
# ou, pour ne reconstruire qu'un seul service :
docker compose build backend && docker compose up -d backend
```

**Peupler la base avec les utilisateurs réels** (import du registre du
personnel — nécessaire sur une base neuve, sinon aucun compte n'existe) :

Le fichier CSV contenant les données RH réelles n'est **pas dans git** (et ne
doit jamais y être — données personnelles). **Demandez-le à l'équipe RH /au
cabinet.** Le script (`backend/src/scripts/importUsers.js`) attend par défaut
un fichier nommé exactement `REGISTRE DU PERSONNEL (1).csv`, au format CSV
séparé par des points-virgules (`nom;prénom;catégorie;département;email`).

Ce chemin par défaut ne fonctionnera **jamais tel quel dans le conteneur**
(il pointe vers un dossier personnel sur la machine de développement, qui
n'existe pas dans l'image Linux du conteneur). La façon fiable de procéder,
quel que soit l'endroit où vous avez reçu le fichier sur votre machine :
```bash
# 1. Copier le CSV à l'intérieur du conteneur backend
docker compose cp "REGISTRE DU PERSONNEL (1).csv" backend:/app/personnel.csv

# 2. Lancer l'import en indiquant explicitement le chemin
docker compose exec backend npm run seed:users -- /app/personnel.csv
```
⚠️ Voir aussi la section 8 : cette commande doit être lancée **dans** le
conteneur, pas depuis votre machine.

**Consulter les logs** :
```bash
docker compose logs backend          # logs du backend uniquement
docker compose logs -f backend       # en continu (Ctrl+C pour arrêter)
docker compose ps                    # état des 3 conteneurs
```

**Inspecter la base Mongo directement** :
```bash
docker compose exec mongo mongosh sge_y3
```

## 8. Points d'attention / pièges connus

**Le `proxy_pass` de nginx n'a pas de `/` final — ne le rajoutez pas.**
```nginx
location /api/ {
    proxy_pass http://backend:5000;   # <-- pas de slash après le port
}
```
Les routes du backend attendent le préfixe `/api` (`/api/auth`,
`/api/collaborator`, etc.). Sans slash final dans `proxy_pass`, nginx transmet
l'URL **telle quelle**, préfixe compris. Si vous ajoutez un `/` final
(`proxy_pass http://backend:5000/;`), nginx **retire** le `/api` avant de
transmettre — le backend ne reconnaît plus la route, et tout part en 404. Ce
détail est le piège nginx le plus classique dans ce genre de configuration :
n'y touchez pas sans comprendre cette différence.

**Les ports `5000` (backend) et `27017` (mongo) ne sont pas exposés à
l'extérieur.** Seul `8080` (frontend) l'est. Conséquence concrète : vous ne
pouvez pas lancer `npm run seed:users` (ou tout autre script) **depuis votre
machine** en visant `localhost:27017` — ce port n'existe plus côté hôte. Il
faut passer par `docker compose exec backend ...` (le script s'exécute alors
à l'intérieur du réseau Docker, où `mongo:27017` est bien joignable). C'est un
choix volontaire : ça réduit la surface exposée sur votre machine.

**En conteneur, Mongo se joint par son nom de service (`mongo`), jamais par
`localhost`.** `docker-compose.yml` fixe `MONGO_URI=mongodb://mongo:27017/sge_y3`
pour le backend. Si vous lancez le backend **hors Docker** (`npm run dev` en
local), `mongo` n'existe pas en tant que nom DNS — il faut alors un
`MONGO_URI` différent (typiquement `mongodb://localhost:27017/...` si un
Mongo tourne en local sur votre machine). C'est pour ça que
`backend/src/config/db.js` a un filet de sécurité :
```js
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sge_y3';
```
Sans variable d'environnement définie, il suppose un Mongo local — pratique en
dev, mais **ne fonctionnera jamais tel quel dans un conteneur** si la variable
`MONGO_URI` n'est pas bien transmise.

## 9. Historique des corrections

**Bug de clé dupliquée (E11000) sur les auto-évaluations.**
En conditions réelles, l'ouverture d'une auto-évaluation pouvait planter avec :
```
E11000 duplicate key error collection: sge_y3.evaluation_instances
index: cycle_label_1_evalue_id_1_template_type_1
```
*Cause* : la fonction qui récupère-ou-crée l'auto-évaluation d'un utilisateur
faisait un `findOne` puis, si rien trouvé, un `create()` séparé — deux
opérations non atomiques. Si deux requêtes arrivaient presque en même temps
(rechargement rapide de page, deux onglets...), les deux passaient le
`findOne` sans rien trouver, puis tentaient toutes les deux de créer le même
document : la seconde violait l'index unique.

*Correctif* : remplacement par un `findOneAndUpdate(..., { upsert: true })`,
atomique côté MongoDB — impossible que deux requêtes concurrentes créent deux
documents en double. Le même défaut existait dans **9 autres fonctions**
similaires (auto-évaluations et revues manager/senior/RH/support/associé), qui
ont toutes été corrigées de la même façon (**10 fonctions au total** :
`collaboratorEvaluationController.js` ×1, `supportController.js` ×1,
`seniorAssistantController.js` ×2, `managerController.js` ×2,
`rhController.js` ×2, `associateController.js` ×2). Vérifié par des tests de
requêtes concurrentes réelles sur plusieurs rôles : aucune erreur, aucun
doublon créé.

**Index unique de `ManagerMemberReview` élargi.** *(fait)*
L'index unique était `(cycle_label, manager_id, member_id)`, sans
`template_type` — alors que la collection contient deux types de documents
différents (`manager-member-evaluation` et `rh-assistant-evaluation`) qui
peuvent théoriquement partager le même triplet. Après vérification qu'aucun
document existant ne violait le nouveau quadruplet
`(cycle_label, manager_id, member_id, template_type)`, l'index a été recréé en
conséquence — à la fois en base et dans le schéma Mongoose
(`backend/src/models/ManagerMemberReview.js`), pour que la correction survive
à un redémarrage ou à une nouvelle base.
