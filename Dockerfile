# ---- Build the Vite frontend ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# Public build-time config (embedded in the client bundle — not secret).
# Railway service variables of the same name override these ARG defaults.
ARG VITE_SOLANA_CLUSTER=devnet
ARG VITE_PACK_PROGRAM_ID=GZUkNP4HhCdqZfZdQFhruArdz5oQ4Y8mgiS9wNPWc1ZL
ARG VITE_SOLANA_RPC_URL=
ENV VITE_SOLANA_CLUSTER=$VITE_SOLANA_CLUSTER \
    VITE_PACK_PROGRAM_ID=$VITE_PACK_PROGRAM_ID \
    VITE_SOLANA_RPC_URL=$VITE_SOLANA_RPC_URL
RUN npm run build

# ---- Serve the static build ----
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
EXPOSE 3000
# `serve` honours the PORT env Railway injects; -s enables SPA fallback.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
