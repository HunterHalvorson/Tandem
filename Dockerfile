# Tandem + Tandem Live in one container: builds the web app, then serves it with live multi-device sync.
#   docker compose up --build     → http://localhost:8787 (and http://<your-LAN-IP>:8787 on phones)
# Google sign-in uses VITE_GOOGLE_CLIENT_ID from frontend/.env.local when present; add http://localhost:8787 to the
# client's Authorised JavaScript origins to use it here. Demo accounts work without it.

FROM node:22-slim AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 HOST=0.0.0.0 DATA_DIR=/data
COPY server/live-server.mjs server/live-server.mjs
COPY --from=build /app/frontend/dist frontend/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
VOLUME /data
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server/live-server.mjs"]
