#!/bin/bash
# ============================================================================
# peom-soul (诗魂) — 服务器端部署脚本
# 用于在服务器上拉取最新镜像并重启服务（对标 ai-hotbed/deploy_remote.sh）
#
# 用法:
#   ./deploy_remote.sh             拉取 latest 并重启
#   ./deploy_remote.sh v1.2.3      拉取指定版本并重启
#
# 也可以从本地通过 SSH 触发（不进入交互式 shell）:
#   ssh root@ps.zzxun.cn 'cd /root/no-jobs/poem-soul && ./deploy_remote.sh'
# ============================================================================

set -e

IMAGE_NAME="peom-soul"
REGISTRY="zzxun.cn:5000"
TAG="${1:-latest}"
COMPOSE_FILE="docker-compose.yml"
HOST_PORT="${PEOM_PORT:-3006}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()  { echo -e "${BLUE}[STEP]${NC}  $*"; }

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   peom-soul 服务器部署                ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# 拉取最新镜像
step "拉取镜像 ${REGISTRY}/${IMAGE_NAME}:${TAG}..."
docker pull ${REGISTRY}/${IMAGE_NAME}:${TAG}

# 停止旧容器
step "停止旧容器..."
docker compose -f ${COMPOSE_FILE} down

# 启动新容器
step "启动新容器..."
docker compose -f ${COMPOSE_FILE} up -d

# 清理旧镜像
step "清理旧镜像..."
docker image prune -f

# 等待服务启动
info "等待服务启动 (5s)..."
sleep 5

# 健康检查
step "健康检查..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:${HOST_PORT}/ 2>/dev/null || echo "000")
if [[ "${HTTP_CODE}" == "200" || "${HTTP_CODE}" == "307" ]]; then
  info "✅ 服务正常 → HTTP ${HTTP_CODE}"
else
  warn "⚠️  服务异常 → HTTP ${HTTP_CODE}"
  echo ""
  echo "查看日志: docker compose -f ${COMPOSE_FILE} logs --tail=50"
fi

# 显示容器状态
echo ""
step "容器状态:"
docker compose -f ${COMPOSE_FILE} ps

echo ""
info "部署完成 🚀"
echo "访问地址: https://ps.zzxun.cn/"
echo ""
