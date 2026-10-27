# syntax=docker/dockerfile:1

# =============================================================================
# SGE-Y3 — image de production du backend (API Express + Mongoose)
# Contexte de build : ./sge-y3/backend  (deploy/docker-compose.yml, service "backend")
# =============================================================================

# -----------------------------------------------------------------------------
# Étape 1 — dépendances de production uniquement (pas de nodemon, pas de devDeps)
# -----------------------------------------------------------------------------
FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# --omit=dev : le package.json ne contient que nodemon en devDependency, mais on
# garde l'option pour que l'image reste légère si des devDeps sont ajoutées.
RUN npm ci --omit=dev --no-audit --no-fund

# -----------------------------------------------------------------------------
# Étape 2 — image d'exécution minimale, utilisateur non privilégié
# -----------------------------------------------------------------------------
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
# --chown=node:node : le service tourne en utilisateur "node" (uid 1000) et doit
# pouvoir écrire dans src/data (questionnaire RH personnalisé, cf. volume
# "backend-data" du docker-compose).
COPY --chown=node:node src ./src

USER node

EXPOSE 5000

# Sonde utilisée par docker-compose (depends_on: condition: service_healthy)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "src/app.js"]
