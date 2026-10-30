# Elder Mi Music AI Studio — one image that runs anywhere Docker does.
#
#   docker build -t elder-mi-studio .
#   docker run -p 3000:3000 --env-file .env.local -v elder-mi-data:/app/.data elder-mi-studio
#
# The volume is the point: without it, the database and every uploaded stem live
# inside the container and disappear when it is replaced. Alternatively point the
# studio at Supabase (see DEPLOY.md) and skip the volume entirely.

# ---------------------------------------------------------------------------
# 1. Dependencies — separate layer, so editing source code does not reinstall.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat keeps the Alpine image compatible with native addons.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# 2. Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
# Ask Next for a self-contained server. Kept out of next.config.mjs so the plain
# `npm run build && npm start` flow on a laptop is unaffected.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# 3. Runtime — only the standalone server, no dev dependencies, non-root.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/.data

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
# `output: "standalone"` emits a server with exactly the files it needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Writable home for the local driver; mount a volume here to keep the data.
RUN mkdir -p /app/.data && chown -R nextjs:nodejs /app/.data
USER nextjs
EXPOSE 3000
VOLUME ["/app/.data"]

# Liveness probe. /api/health answers 200 without touching the database, so a
# Supabase outage never marks the container unhealthy — only a dead server does.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
