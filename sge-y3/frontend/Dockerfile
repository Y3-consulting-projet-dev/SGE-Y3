# push server prod srv01
FROM node:24-alpine AS build

WORKDIR /app

ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL:-/api}

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM caddy:2.10-alpine AS runtime

COPY Caddyfile /etc/caddy/Caddyfile

COPY --from=build /app/dist /srv

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:80/healthz >/dev/null 2>&1 || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
