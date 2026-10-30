# Notes de déploiement — correctif « Validé RH » et transmission à la RH

Serveur concerné : **192.168.0.50** (srv01).

**Branche :** les correctifs sont sur `main` du dépôt `Y3-consulting-projet-dev/SGE-Y3`. D'après l'ancienne documentation de déploiement (`deploy/DEPLOIEMENT.md`, supprimée dans le commit `aa1a623`), Coolify déployait la branche **`deploy`** du fork **`davidagoua/SGE-Y3`**. Vérifier dans Coolify (onglet *General* / *Source*) quel dépôt et quelle branche sont utilisés. Si ce n'est pas `main` de `Y3-consulting-projet-dev/SGE-Y3`, reporter d'abord les correctifs sur cette branche.

## 1. Pourquoi redéployer

Deux problèmes ont été corrigés dans le code. Le serveur tourne encore avec l'ancienne version, donc ils persistent en production :

1. **Erreur à la validation RH.** Sur la page « Validations RH », la validation échoue avec :
   ```
   EvaluationInstance validation failed: status: `Validé RH` is not a valid enum value for path `status`.
   ```
   Le code écrivait le statut `Validé RH` (avec accent) alors que la base n'acceptait que `Valide RH` (sans accent). Le modèle accepte désormais les deux écritures.
2. **Lenteur du bouton « Transmettre à la RH »** (écran associé). Le clic envoyait deux requêtes successives ; il n'en envoie plus qu'une.

Les commits concernés sont sur `main` : `8b958b7`, `94de715`, et le commit suivant, qui ajoute le script de migration (section 4).

## 2. Services à reconstruire

| Service | À reconstruire ? | Raison |
|---|---|---|
| `backend` | **Oui** | Le Dockerfile copie le code (`src/`) dans l'image au moment du build. Un simple redémarrage relance l'ancien code, et l'erreur « Validé RH » continue. |
| `web` (frontend) | **Oui** | Le frontend est compilé en fichiers statiques au build (`npm run build`). Le code du bouton « Transmettre à la RH » a changé. |
| `mongo` | **Non** | Ne pas toucher à ce service ni à ses volumes. |

**URL de l'API :** elle est figée au moment du build du frontend, par la variable `VITE_API_URL` (argument de build, valeur par défaut `/api`). Caddy redirige ensuite `/api/*` vers `backend:5000`. Un redémarrage du conteneur `web` ne change donc ni le code ni l'URL : il faut **reconstruire l'image**. Gardez la valeur actuelle de `VITE_API_URL`, il n'y a rien à modifier.

## 3. Reconstruire et redémarrer

### Avec Coolify
Le dépôt est configuré pour Coolify : les contextes de build sont relatifs à la racine du dépôt.
1. Vérifier que l'application pointe sur une branche qui contient les correctifs (voir « Branche » en haut de ce document), au dernier commit.
2. Lancer un **Redeploy** en forçant la reconstruction sans cache (option « Force rebuild » / « no cache »).
3. Attendre que `backend` puis `web` soient « healthy ».

### En ligne de commande (docker compose)
À lancer **depuis la racine du dépôt**, sur le serveur, après un `git pull` de la branche qui contient les correctifs (ici `main`). Remplacer `<fichier-env>` par le fichier d'environnement de production utilisé habituellement (modèle : `deploy/.env.production.example`).

```bash
git checkout main && git pull

docker compose -f deploy/docker-compose.yml --project-directory . --env-file <fichier-env> \
  build --no-cache backend web

docker compose -f deploy/docker-compose.yml --project-directory . --env-file <fichier-env> \
  up -d backend web

docker compose -f deploy/docker-compose.yml --project-directory . --env-file <fichier-env> ps
```

⚠️ Ne pas utiliser `down -v` : cette commande supprime le volume MongoDB et toutes les données.

## 4. Migration des données (après le déploiement)

Le script `backend/src/scripts/migrateValideRh.js` remplace l'ancien statut `Valide RH` par `Validé RH` dans les collections `EvaluationInstance` et `ManagerMemberReview`. Il ne modifie pas `updated_at`.

- **À lancer seulement après avoir vérifié que la nouvelle version fonctionne** (section 5). L'ancienne version du code n'accepte pas `Validé RH` : après la migration, revenir à l'ancien code casserait l'enregistrement des évaluations migrées.
- Faire une sauvegarde MongoDB (`mongodump`) avant le passage en mode réel.
- Le script peut être relancé sans risque : un second passage modifie 0 document.

**Étape 1 — simulation (ne modifie rien) :**
```bash
docker compose -f deploy/docker-compose.yml --project-directory . --env-file <fichier-env> \
  exec backend node src/scripts/migrateValideRh.js --dry-run
```
Sortie attendue : le nombre de documents à migrer par collection, puis un total.

**Étape 2 — migration réelle :**
```bash
docker compose -f deploy/docker-compose.yml --project-directory . --env-file <fichier-env> \
  exec backend node src/scripts/migrateValideRh.js
```
Sortie attendue : `trouvé(s)` / `modifié(s)` par collection, puis un total.

Avec Coolify, ouvrir le terminal du conteneur `backend` et lancer `node src/scripts/migrateValideRh.js --dry-run`, puis la même commande sans `--dry-run`.

## 4 bis. Configuration de « Mot de passe oublié »

Par défaut (`PASSWORD_RESET_MODE=recovery_code`), « Mot de passe oublié » fonctionne **sans e-mail** : chaque utilisateur possède un code de secours personnel, affiché une seule fois, qu'il conserve lui-même. Il saisit son e-mail et ce code pour choisir un nouveau mot de passe.

**⚠️ Effet visible à la prochaine connexion de chaque utilisateur :** s'il n'a pas encore de code de secours, l'écran « Votre code de secours » s'affiche ; il ne peut pas continuer sans cocher « J'ai conservé mon code en lieu sûr ». Les sessions déjà ouvertes au moment du déploiement sont redirigées vers cet écran au premier appel. Prévenir les utilisateurs avant la mise en production.

La connexion avec le mot de passe par défaut `Ycube@c2026` reste autorisée : chacun peut le changer quand il le souhaite depuis son profil.

Les événements (code généré, régénéré, utilisé, échec, blocage) sont enregistrés dans la collection MongoDB `security_events` (compte, IP, date ; jamais le code). Aucune migration n'est nécessaire : les nouveaux champs des utilisateurs sont créés à la première utilisation.

Variables d'environnement :

| Variable | Valeur | Sans elle |
|---|---|---|
| `PASSWORD_RESET_MODE` | `recovery_code` (par défaut) ou `email`. | Mode `recovery_code`. |
| `TRUST_PROXY` | Nombre de proxys devant le backend. Avec Coolify (Traefik) puis Caddy : `2`. | La limite de 10 demandes / 15 min par adresse IP est **désactivée** (avertissement `[rateLimit]` dans les logs). La limite par compte (5 échecs → blocage 15 min) reste active. |
| `FRONTEND_URL` | Adresse publique du site, sans slash final (ex. `https://sge.exemple.com`). | En mode `email` uniquement : aucun lien n'est envoyé (erreur dans les logs). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Serveur d'envoi des e-mails. | En mode `email` uniquement : les e-mails ne partent pas. |

`FRONTEND_URL` sert aussi d'origine autorisée (CORS) : si elle est renseignée, elle doit correspondre exactement à l'adresse tapée dans le navigateur.

**Pour que `TRUST_PROXY=2` donne la vraie IP du client**, Caddy doit faire confiance au proxy Traefik placé devant lui. Sinon, il remplace l'en-tête `X-Forwarded-For` par l'IP de Traefik, et tous les utilisateurs partagent alors la même limite. Ajouter dans le bloc global de `sge-y3/frontend/Caddyfile`, puis reconstruire `web` :
```
{
	admin off
	auto_https off
	servers {
		trusted_proxies static private_ranges
	}
}
```
Ce réglage n'a pas été testé (Docker indisponible sur le poste de développement) : vérifier après déploiement, en faisant 11 demandes de réinitialisation depuis un même poste, que la 11ᵉ renvoie « Trop de demandes… », et qu'un autre poste n'est pas bloqué.

**Sessions :** après une réinitialisation ou un changement de mot de passe, les sessions déjà ouvertes de l'utilisateur sont fermées ; il doit se reconnecter sur ses autres appareils.

## 5. Tests après le déploiement

Ouvrir les logs du backend dans un terminal à part :
```bash
docker compose -f deploy/docker-compose.yml --project-directory . --env-file <fichier-env> \
  logs -f backend | grep submit-rh
```
(Avec Coolify : onglet « Logs » du service `backend`.)

**Test 1 — Validation RH**
1. Se connecter avec un compte RH.
2. Ouvrir « Validations RH », sélectionner au moins une évaluation et cliquer sur « Valider la sélection ».
3. Attendu : la validation réussit, sans message `is not a valid enum value`.

**Test 2 — Transmission à la RH**
1. Se connecter avec un compte associé qui a une évaluation reçue à traiter.
2. Aller à la dernière page de l'évaluation, remplir les notes et le commentaire de section, puis cliquer sur « Transmettre à la RH ».
3. Attendu : le message « Évaluation transmise à la RH (…) » s'affiche.
4. Dans les logs, une ligne indique la durée du traitement, par exemple :
   ```
   submit-rh 6650f1c2a9e4b0012345abcd: 184.512ms
   ```

## 6. À remonter après le déploiement

- Le résultat des deux tests.
- La durée affichée par `submit-rh` (une ou deux mesures).
- Les totaux affichés par le script de migration, en simulation puis en réel.

Cette mesure `submit-rh` est temporaire : elle sera retirée du code une fois la durée connue.
