FROM node:22-bookworm

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  procps \
  python3 \
  build-essential \
  gosu \
  && rm -rf /var/lib/apt/lists/*

# OpenClaw installation
# Version is pinned for stability. GitHub Action will create PRs for updates.
# See: https://github.com/openclaw/openclaw/releases
# Current version: 2026.2.3-1 (as of 2026-02-05)
RUN npm install -g openclaw@2026.2.3-1

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY src ./src
COPY scripts ./scripts
COPY templates ./templates

RUN useradd -m -s /bin/bash openclaw \
  && chown -R openclaw:openclaw /app \
  && mkdir -p /data && chown openclaw:openclaw /data \
  && chmod +x /app/scripts/entrypoint.sh

ENV PORT=8080
ENV OPENCLAW_ENTRY=/usr/local/lib/node_modules/openclaw/dist/entry.js
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:8080/setup/healthz || exit 1

# Run as root initially, entrypoint.sh handles user switching after fixing permissions
ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["sh", "-c", "node scripts/auto-setup.js && node src/server.js"]

