# Build context: the rebuild/ folder (see docker-compose.yml)
FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG BACKEND_URL=http://backend:4000
ENV BACKEND_URL=$BACKEND_URL NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace shared --workspace frontend --include-workspace-root
COPY shared shared
COPY frontend frontend
RUN npm run build -w shared && npm run build -w frontend

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static frontend/.next/static
USER node
EXPOSE 3100
CMD ["node", "frontend/server.js"]
