# Public website — build from the `rebuild/` folder:
#   docker build -f site/Dockerfile -t mekanezm-site --build-arg SITE_URL=https://mekanezm.com .
#   docker run -d -p 3300:3300 -e REVALIDATE_SECRET=... --restart unless-stopped mekanezm-site
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY site/package.json site/
RUN npm ci --workspace site --include-workspace-root=false --ignore-scripts
COPY site site
ARG SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$SITE_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w site

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3300 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/site/.next/standalone ./
COPY --from=build /app/site/.next/static ./site/.next/static
COPY --from=build /app/site/public ./site/public
USER node
EXPOSE 3300
CMD ["node", "site/server.js"]
