# push server prod srv01
FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY --chown=node:node src ./src

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 || exit 1

CMD ["node", "src/app.js"]
