# ─── Argens API — Dockerfile ──────────────────────────────────────────────────
#
# Single-stage build. We keep dev deps so Prisma CLI and tsc are available,
# then run the compiled server. Image size is ~400MB, acceptable for a private
# VPS deployment where cold-start time doesn't matter.
#
# Build context must be the monorepo root (argens/), not apps/api/ —
# pnpm workspaces need the root package.json and lock file.
#   docker build -t argens-api -f apps/api/Dockerfile .

FROM node:22-alpine

# pnpm via corepack (ships with Node 22)
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# ── Layer 1: workspace manifests (rarely change → cached) ──
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/

# ── Layer 2: install all deps ──
RUN pnpm install --no-frozen-lockfile

# ── Layer 3: Prisma schema → generate client ──
COPY apps/api/prisma ./apps/api/prisma/
RUN pnpm --filter @argens/api exec prisma generate

# ── Layer 4: source code → compile ──
COPY apps/api/src ./apps/api/src/
RUN pnpm --filter @argens/api build

# Switch into the API package directory for all runtime operations
WORKDIR /app/apps/api

EXPOSE 3001

# On startup:
#   1. Run pending migrations (idempotent, safe on restarts)
#   2. Start the server
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/index.js"]
