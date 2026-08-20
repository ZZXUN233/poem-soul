# ============================================
# peom-soul (诗魂) 多阶段构建
# 对标 ai-hotbed / docker/Dockerfile，去掉 prisma（本项目无数据库）
# 语料数据 public/data/ 已随仓库提交，需 COPY 进构建阶段
# 对外: <REGISTRY>/peom-soul:latest ; 内部端口 3000
# ============================================

# ── Stage 1: 安装生产依赖 ─────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: 构建 ─────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# 语料数据（约 540 万字）与源码
COPY public ./public
COPY src ./src
COPY scripts ./scripts
COPY tsconfig.json next.config.ts next-env.d.ts ./

# 构建 Next.js（npm run build == next build）
RUN npm run build

# ── Stage 3: 生产运行 ─────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# wget 用于 Docker HEALTHCHECK
RUN apk add --no-cache wget

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 本项目无 /api/health；用轻量真实接口 /api/random 做健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/random || exit 1

CMD ["node", "node_modules/.bin/next", "start"]
