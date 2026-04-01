FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the agent is running in production
ENV NODE_ENV production

# Default command to start the agent
CMD ["node", "index.js"]
