# Build context: the rebuild/ folder (see docker-compose.yml)
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace shared --workspace backend --include-workspace-root
COPY shared shared
COPY backend backend
RUN npm run build -w shared \
 && npx -w backend prisma generate \
 && npm run build -w backend \
 && npm prune --omit=dev --workspace shared --workspace backend

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/shared/package.json shared/package.json
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
WORKDIR /app/backend
USER node
EXPOSE 4000
# Migrations are applied on every start; they are no-ops when nothing changed.
CMD ["sh", "-c", "node ../node_modules/prisma/build/index.js migrate deploy && node dist/server.js"]
