# Node.js の版は Dependabot が更新する。3つの FROM は同じ版にそろえる

# ============================================
# 1. 依存パッケージを入れる
# ============================================
FROM node:24.22.3-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ============================================
# 2. ビルドする
# ============================================
FROM node:24.22.3-slim AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# ============================================
# 3. 動かす
# ============================================
FROM node:24.22.3-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN mkdir .next && chown node:node .next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
