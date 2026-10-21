# Obraz aplikace: sestavená webová aplikace + server s API kurzů ČNB (Node.js, bez dalších závislostí).
# Sestavení:  docker build -t cestovni-prikazy .
# Spuštění:   docker run -p 8787:8787 -v cp-data:/data cestovni-prikazy
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS build
WORKDIR /src
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/core/package.json packages/core/
COPY packages/documents/package.json packages/documents/
COPY packages/rules/package.json packages/rules/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @cp/web build && pnpm --filter @cp/server build

FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    STATIC_DIR=/app/public \
    RATE_CACHE_DIR=/data/kurzy
COPY --from=build /src/apps/server/dist/server.mjs ./server.mjs
COPY --from=build /src/apps/web/dist ./public
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8787/zdravi || exit 1
CMD ["node", "server.mjs"]
