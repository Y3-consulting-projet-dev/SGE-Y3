# syntax=docker/dockerfile:1

# =============================================================================
# SGE-Y3 — image de production du frontend (SPA React buildée + Caddy)
# Contexte de build : ./sge-y3/frontend  (deploy/docker-compose.yml, service "web")
#
# Le frontend est compilé ici (Vite) puis servi par Caddy, qui joue en plus le
# rôle de reverse proxy pour l'API : le navigateur ne parle qu'à une seule
# origine (le domaine public), et /api/* est renvoyé vers le conteneur backend.
# =============================================================================

# -----------------------------------------------------------------------------
# Étape 1 — build du bundle React avec Vite
# -----------------------------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# L'URL de l'API est figée dans le bundle par Vite au moment du build.
# "/api" => requêtes relatives à l'origine publique, routées par Caddy vers
# le service "backend".
#
# ATTENTION : Coolify transmet systématiquement --build-arg VITE_API_URL. Si la
# variable n'est pas définie côté Coolify, le build-arg arrive VIDE et écraserait
# la valeur par défaut ; le bundle retomberait alors sur la vieille IP LAN codée
# dans src/api/apiBase.js. D'où le fallback explicite ci-dessous.
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL:-/api}

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Étape 2 — Caddy : fichiers statiques + reverse proxy /api
# -----------------------------------------------------------------------------
FROM caddy:2.10-alpine AS runtime

# Caddyfile : site HTTP sur :80 (TLS terminé par le proxy Coolify/Traefik en amont)
COPY Caddyfile /etc/caddy/Caddyfile

# Bundle produit par Vite
COPY --from=build /app/dist /srv

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:80/healthz >/dev/null 2>&1 || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
