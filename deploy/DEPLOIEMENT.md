# Déploiement SGE-Y3 (Coolify / Docker Compose)

Branche : **`deploy`**. Tout le nécessaire de déploiement est regroupé dans `deploy/`.

## 1. Architecture des conteneurs

```
Internet
   │  HTTPS (certificat géré par Coolify)
   ▼
Traefik (reverse proxy Coolify)
   │  HTTP :80 — route vers le service "web" uniquement
   ▼
web  (Caddy + bundle React buildé par Vite)
   │  /api/* → reverse_proxy HTTP :5000
   ▼
backend (Node 24 / Express 5)
   │  TCP :27017
   ▼
mongo (MongoDB 7, volume "mongo-data")
```

Principes retenus :

- **Aucun port n'est publié sur l'hôte** (`ports:` absent du compose) : chaque
  service utilise seulement `expose:`. Seul le proxy de Coolify atteint le
  service `web`, sur son port 80 interne.
- **Caddy** sert les fichiers statiques **et** joue le reverse proxy de l'API :
  le navigateur ne voit qu'une seule origine, donc pas de CORS en pratique.
- **Le frontend est compilé dans l'image** (étape `npm run build`) : aucun
  serveur de développement Node en production. `VITE_API_URL=/api` est figé dans
  le bundle pour que les appels soient relatifs à l'origine publique.
- **TLS terminé en amont** : Caddy écoute en HTTP simple (`auto_https off`),
  Coolify/Traefik gère les certificats.
- Images Node en **utilisateur non privilégié** (`node`, uid 1000) ; seules les
  données persistantes passent par des volumes nommés.

## 2. Fichiers ajoutés par la branche

| Fichier | Rôle |
|---|---|
| `deploy/docker-compose.yml` | Pile complète : `mongo`, `backend`, `web` ; healthchecks, volumes, réseau interne |
| `deploy/docker-compose.local.yml` | Surcharge de test local (publie `localhost:8080`) — **non utilisée en production** |
| `sge-y3/backend/Dockerfile` | Image API multi-étapes, `npm ci --omit=dev`, utilisateur `node`, `HEALTHCHECK` |
| `sge-y3/backend/.dockerignore` | Exclut `node_modules`, `.env*`, tests ad-hoc |
| `sge-y3/frontend/Dockerfile` | Étape 1 : build Vite ; étape 2 : Caddy + `dist` |
| `sge-y3/frontend/Caddyfile` | SPA + `reverse_proxy /api/* → backend:5000`, en-têtes, cache, `/healthz` |
| `sge-y3/frontend/.dockerignore` | Exclut `node_modules`, `dist`, `.env*` |
| `deploy/.env.production.example` | Modèle de variables d'environnement (aucun secret réel) |
| `deploy/DEPLOIEMENT.md` | Ce document |

> Les `Dockerfile` et `.dockerignore` restent volontairement **à côté de leur
> code** (`sge-y3/backend/`, `sge-y3/frontend/`) : c'est le contexte de build.
> 
> ⚠️ **Chemins des contextes** : Coolify lance `docker compose` avec
> `--project-directory <racine du dépôt>` ; cette option fait résoudre **tous**
> les chemins relatifs depuis la racine du dépôt, pas depuis `deploy/`. Les
> contextes sont donc `./sge-y3/backend` et `./sge-y3/frontend`. En local, il
> faut lancer les commandes avec la même option (voir §6).

## 3. Prérequis

- Un serveur Coolify fonctionnel (v4+) avec Docker et son reverse proxy.
- Le dépôt `davidagoua/SGE-Y3` (fork contenant la branche `deploy`) accessible
  depuis Coolify (GitHub App ou déploiement par clé).
- Un domaine (ou sous-domaine) pointant vers le serveur Coolify.

## 4. Déploiement sur Coolify — pas à pas

1. **Créer la resource**
   - Coolify → *Projects* → votre projet → **+ New Resource** → **Docker Compose**
     (ou *Public Repository* puis type « Docker Compose »).
   - Dépôt : `https://github.com/davidagoua/SGE-Y3`
   - Branche : **`deploy`**
   - *Base Directory* : **`/deploy`**
   - *Docker Compose Location* : **`/docker-compose.yml`**
   - Coolify exécutera `docker compose --project-directory <racine du dépôt>` :
     c'est ce qui rend les contextes `./sge-y3/...` corrects.

2. **Variables d'environnement**
   - Onglet *Environment Variables*, vue **Developer**, bouton **Paste .env** :
     collez le contenu de `deploy/.env.production.example` après avoir remplacé
     les `CHANGE_ME_*`.
   - Génération des secrets :
     ```bash
     openssl rand -hex 24                    # MONGO_ROOT_PASSWORD
     openssl rand -base64 48 | tr -d '\n'    # JWT_SECRET
     ```
     `MONGO_ROOT_PASSWORD` doit être *URL-safe* (utiliser `-hex`, pas `-base64`),
     car il est repris dans `MONGO_URI`.
   - `MONGO_URI` doit contenir **exactement** le mot de passe de
     `MONGO_ROOT_PASSWORD` et pointer sur l'hôte `mongo` (nom du service).

3. **Domaine**
   - Onglet *Domains* → service **`web`**, port **80**.
   - Ou renseignez directement `SERVICE_FQDN_WEB=https://sge.votre-domaine.com`
     (sans slash final) : Coolify crée la route automatiquement.
   - Ne mappez **jamais** de domaine sur `backend` ni sur `mongo`. Le trafic
     API passe par `web` (`/api/*`).
   - Si la route ne se crée pas automatiquement, utilisez la variante avec port
     explicite : `SERVICE_FQDN_WEB_80=https://sge.votre-domaine.com`.

4. **Déployer**
   - Cliquez sur *Deploy*. Coolify construit `backend` et `frontend`
     (≈1–3 min selon la machine), attend les healthchecks, puis démarre.
   - Le premier déploiement peut échouer si les variables obligatoires
     (`JWT_SECRET`, `MONGO_URI`, `MONGO_ROOT_*`) sont absentes : le compose
     utilise `${VAR:?message}` pour échouer explicitement.

5. **Vérifier**
   ```bash
   curl -fsS https://sge.votre-domaine.com/healthz          # → 200, "OK" (texte)
   curl -fsS https://sge.votre-domaine.com/api/health       # → {"status":"ok"}
   curl -fsS -o /dev/null -w '%{http_code}\n' https://sge.votre-domaine.com/
   ```
   Puis ouvrir l'application, se connecter avec un compte issu du CSV.

6. **Initialiser les utilisateurs**
   L'application n'a pas d'inscription : les comptes viennent d'un CSV
   (`REGISTRE DU PERSONNEL`). Le script accepte un chemin en argument.

   ```bash
   # 1. copier le CSV sur le serveur, puis dans le conteneur backend
   docker cp "REGISTRE DU PERSONNEL (1).csv" <conteneur-backend>:/tmp/registre.csv
   # 2. lancer l'import (ré-exécutable : met à jour les comptes existants)
   docker exec -it <conteneur-backend> npm run seed:users -- /tmp/registre.csv
   ```
   > ⚠️ **Ré-exécuter l'import réinitialise le mot de passe de tous les comptes
   > existants** à `Ycube@c2026` (`backend/src/scripts/importUsers.js:94-105`).
   > Ne le lancez jamais sur une base déjà en production sans raison.
   > Tous les comptes partagent ce mot de passe initial et l'application
   > n'impose pas son changement : faites-le changer dès la première connexion.

## 5. Variables d'environnement

| Variable | Obligatoire | Défaut compose | Rôle |
|---|---|---|---|
| `SERVICE_FQDN_WEB` | recommandé | vide | URL publique (`https://…`, sans slash final) ; Coolify l'utilise pour la route Traefik |
| `MONGO_ROOT_USER` | oui | — | Utilisateur admin MongoDB créé au premier démarrage |
| `MONGO_ROOT_PASSWORD` | oui | — | Mot de passe admin MongoDB (URL-safe, `openssl rand -hex`) |
| `MONGO_URI` | oui | — | URI utilisée par le backend (hôte `mongo`) |
| `JWT_SECRET` | oui | — | Signature des JWT |
| `JWT_EXPIRES_IN` | non | `24h` | Durée de vie des jetons |
| `FRONTEND_URL` | non | vide | Origines CORS autorisées (vide = même origine, rien à faire) |
| `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` | non | vides | Notifications e-mail ; sans `SMTP_HOST`, les envois sont ignorés |
| `VITE_API_URL` | non | `/api` | Build-arg du frontend (chemin de l'API compilé dans le bundle). Coolify transmet toujours ce build-arg : s'il est vide, le Dockerfile retombe sur `/api` |

> Les variables `MONGO_ROOT_*` ne sont appliquées qu'à la **création** du volume
> `mongo-data`. Les modifier après coup n'a aucun effet sur une base existante.

## 6. Test local avant de pousser en production

À lancer **depuis la racine du dépôt** (le `--project-directory .` reproduit
exactement la façon dont Coolify appelle Compose) :

```bash
cd <racine-du-dépôt>
cp deploy/.env.production.example deploy/.env.production   # remplacer les CHANGE_ME_*

DC="docker compose --project-directory . -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml --env-file deploy/.env.production"

$DC up -d --build          # → http://localhost:8080
$DC logs -f web backend
$DC down -v                # arrêt + suppression des données de test
```

## 7. Exploitation

**Journaux** : Coolify → resource → *Logs* (les conteneurs écrivent sur
stdout/stderr ; Caddy journalise les requêtes HTTP).

**Mise à jour** : pousser sur `deploy` (ou *Redeploy* dans Coolify). Les volumes
`mongo-data` et `backend-data` sont conservés.

**Sauvegarde MongoDB** :
```bash
docker exec <conteneur-mongo> sh -c \
  'mongodump --quiet --gzip --archive=/tmp/sge.gz \
   --username "$MONGO_INITDB_ROOT_USERNAME" \
   --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin'
docker cp <conteneur-mongo>:/tmp/sge.gz ./sge-backup-$(date +%F).gz
```
Restauration :
```bash
docker cp ./sge-backup-XXXX-XX-XX.gz <conteneur-mongo>:/tmp/restore.gz
docker exec <conteneur-mongo> sh -c \
  'mongorestore --gzip --archive=/tmp/restore.gz --drop \
   --username "$MONGO_INITDB_ROOT_USERNAME" \
   --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin'
```
Activez aussi les sauvegardes planifiées de Coolify sur le volume `mongo-data`.

## 8. Dépannage

| Symptôme | Cause probable | Action |
|---|---|---|
| Le déploiement s'arrête : `JWT_SECRET est requis` | Variable manquante | Renseigner la variable dans Coolify puis redéployer |
| `unable to prepare context: path "/artifacts/..." not found` | Contexte de build résolu depuis la racine du dépôt (`--project-directory`) | Garder `context: ./sge-y3/...` (jamais `../`) ; en local, passer `--project-directory .` |
| `MongoServerError: Authentication failed` | `MONGO_URI` incohérent avec `MONGO_ROOT_*`, ou volume créé avec d'autres identifiants | Aligner les valeurs ; sinon recréer le volume (perte de données) |
| 502 Bad Gateway sur `/` | `web` pas encore *healthy*, ou domaine mappé sur `backend` | Vérifier les logs `web` ; le domaine doit pointer sur `web` port 80 |
| 502 sur `/api/*` uniquement | `backend` en échec (Mongo, variables) | `docker logs <backend>` ; healthcheck `/api/health` |
| Page blanche, appels `http://192.168.0.50:5000` | Bundle compilé avec l'ancienne URL par défaut | Vérifier que le build utilise `VITE_API_URL=/api` (build-arg), puis rebuild sans cache |
| Erreur CORS | `FRONTEND_URL` renseigné avec un slash final ou un mauvais schéma | Laisser vide (même origine) ou mettre l'URL exacte |
| Les personnalisations du questionnaire RH disparaissent | Volume `backend-data` absent/supprimé | Ne pas utiliser `down -v` en production ; vérifier le volume |

## 9. Points de vigilance applicatifs (issus de l'audit du code)

La mise en ligne expose l'API à Internet : ces points, déjà présents dans `main`,
ne sont pas corrigés par la conteneurisation et méritent un traitement rapide.

1. **Escalade de privilèges par le nom** — `PUT /api/auth/me/profile` modifie
   librement prénom/nom et `getPermissionRole()` accorde `admin` à un utilisateur
   dont le nom contient « Isabella Beda ». N'importe quel compte connecté peut
   donc devenir administrateur RH (`backend/src/utils/userMapping.js:76-80`,
   `authController.js:81-124`). À corriger avant toute ouverture externe large.
2. **`/api/committee/*` sans contrôle de rôle** — tout utilisateur authentifié
   peut écrire la décision finale du comité (`backend/src/routes/committeeRoutes.js:8-10`).
3. **Mot de passe par défaut commun** `Ycube@c2026` et aucune obligation de le
   changer.
4. **JWT non révocable** (24 h) et `requireRh` lit `permission_role` dans le
   jeton : un changement de droits n'est pas immédiat.
5. **CORS permissif** si `FRONTEND_URL` est vide (le mode par défaut de ce
   compose) : sans conséquence fonctionnelle grâce à Caddy, mais à restreindre
   si l'API devient joignable directement.
6. **Secrets déjà présents dans l'historique Git** (`backend/.env` d'un ancien
   commit, identifiants EmailJS côté frontend) : générez de **nouveaux**
   secrets pour ce déploiement — c'est ce que fait `.env.production.example`.

## 10. Limites connues

- Le volume `backend-data` est monté sur `/app/src/data` et initialisé depuis
  l'image : il **fige** `competencyMatrix.generated.json` au premier démarrage.
  Si une mise à jour modifie la matrice de compétences, il faut copier le
  nouveau fichier dans le volume (ou le supprimer pour le réinitialiser) —
  sinon les nouvelles évaluations continueront d'utiliser l'ancienne matrice.
- L'application n'a **pas de routeur côté frontend** : toutes les URL retombent
  sur l'index (`try_files`), mais il n'existe pas de deep-link vers un écran
  précis.
- Les manuels utilisateur (`docs/manuels-utilisateur/`) ne sont pas servis par
  l'application.
