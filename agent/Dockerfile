# Build stage for TypeScript transpilation
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Transpile TypeScript to JavaScript for an optimized production runner
RUN npx tsc --outDir dist

# Production runner stage
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Add curl for automated heartbeats (optional dependency)
RUN apk add --no-cache curl

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./

# Default command to start the optimized production agent
CMD ["node", "index.js"]
