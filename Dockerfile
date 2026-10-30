FROM node:22.16-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:22.16-bookworm-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_POSTHOG_KEY=
ARG NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}
ENV NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22.16-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DECK_STORAGE_DIR=/app/.data/decks

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-impress \
    python3 \
    fonts-liberation \
    fonts-crosextra-carlito \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/.data/decks \
    && chown -R node:node /app

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
