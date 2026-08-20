#!/usr/bin/env bash
# ============================================================================
# peom-soul (诗魂) 部署脚本 —— 对标 ai-hotbed/deploy.sh
#
# 用法:
#   ./deploy.sh build           构建 Docker 镜像
#   ./deploy.sh start           启动服务
#   ./deploy.sh stop            停止服务
#   ./deploy.sh restart         重启服务
#   ./deploy.sh status          查看服务状态
#   ./deploy.sh logs            查看日志
#   ./deploy.sh push            构建 + 推送镜像到私有仓库
#   ./deploy.sh remote-update   远程服务器拉取镜像并重启
#   ./deploy.sh nginx-reload    重载 NGINX 配置
#   ./deploy.sh health          健康检查
#   ./deploy.sh full            一键全流程: push → remote-update → health
#   ./deploy.sh rollback        回滚到上一个镜像版本
#   ./deploy.sh clean           清理旧镜像和停止的容器
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# ── 配置 ────────────────────────────────────────────────────────────
IMAGE_NAME="peom-soul"
REGISTRY="${REGISTRY:-zzxun.cn:5000}"
TAG="${TAG:-latest}"
COMPOSE_CMD="docker compose"
ENV_FILE=".env"
COMPOSE_FILE="docker-compose.yml"
DOCKERFILE="docker/Dockerfile"

# 宿主映射端口（ai-hotbed/demos 占 3005，本服务用 3006）
HOST_PORT="${PEOM_PORT:-3006}"

# 远程服务器配置（可通过环境变量覆盖）
REMOTE_HOST="${REMOTE_HOST:-root@ps.zzxun.cn}"
REMOTE_PATH="${REMOTE_PATH:-/root/no-jobs/poem-soul}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()  { echo -e "${BLUE}[STEP]${NC}  $*"; }

# ── 预检：.env 非必需（无数据库），存在则校验，不存在则提示后继续 ──
check_env() {
  if [[ -f "${ENV_FILE}" ]]; then
    info "检测到 ${ENV_FILE}，正常加载。"
  else
    warn "${ENV_FILE} 不存在。本项目自包含、无数据库，将继续以默认配置部署。"
    warn "如需自定义（见 .env.example），请先创建 ${ENV_FILE}。"
  fi
}

# ── 构建 ────────────────────────────────────────────────────────────
build() {
  check_env
  step "构建 Docker 镜像..."
  ${COMPOSE_CMD} -f "${COMPOSE_FILE}" build
  info "构建完成"
}

# ── 服务管理 ────────────────────────────────────────────────────────
start() {
  check_env
  step "启动服务..."
  ${COMPOSE_CMD} -f "${COMPOSE_FILE}" up -d
  info "服务已启动 (宿主端口 ${HOST_PORT} -> 容器 3000)"
}

stop() {
  step "停止服务..."
  ${COMPOSE_CMD} -f "${COMPOSE_FILE}" down
  info "服务已停止"
}

restart() {
  step "重启服务..."
  ${COMPOSE_CMD} -f "${COMPOSE_FILE}" restart
  info "服务已重启"
}

status() {
  echo -e "${BLUE}═══ peom-soul 服务状态 ═══${NC}"
  ${COMPOSE_CMD} -f "${COMPOSE_FILE}" ps 2>/dev/null || warn "无法获取服务状态"
}

logs() {
  ${COMPOSE_CMD} -f "${COMPOSE_FILE}" logs -f --tail=100
}

# ── 推送镜像到私有仓库 ──────────────────────────────────────────────
push() {
  check_env

  step "构建 Docker 镜像 (${IMAGE_NAME}:${TAG})..."
  docker build \
    -f "${DOCKERFILE}" \
    -t ${IMAGE_NAME}:${TAG} .

  step "打标签 ${REGISTRY}/${IMAGE_NAME}:${TAG}..."
  docker tag ${IMAGE_NAME}:${TAG} ${REGISTRY}/${IMAGE_NAME}:${TAG}

  step "推送到私有仓库..."
  docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}

  info "推送完成 → ${REGISTRY}/${IMAGE_NAME}:${TAG}"
}

# ── 远程部署 ────────────────────────────────────────────────────────
remote_update() {
  step "远程部署 → ${REMOTE_HOST}:${REMOTE_PATH}"

  # 同步配置文件到服务器
  step "同步配置文件..."
  scp "${ENV_FILE}" "${REMOTE_HOST}:${REMOTE_PATH}/${ENV_FILE}" 2>/dev/null || \
    warn "${ENV_FILE} 不存在或同步失败，跳过（无数据库时正常）"
  scp "${COMPOSE_FILE}" "${REMOTE_HOST}:${REMOTE_PATH}/${COMPOSE_FILE}"

  ssh "${REMOTE_HOST}" "bash -s" << REMOTE_SCRIPT
    set -e

    IMAGE_NAME="${IMAGE_NAME}"
    REGISTRY="${REGISTRY}"
    TAG="${TAG}"
    COMPOSE_FILE="${COMPOSE_FILE}"
    HOST_PORT="${HOST_PORT}"

    echo "[REMOTE] 拉取最新镜像..."
    docker pull \${REGISTRY}/\${IMAGE_NAME}:\${TAG}

    echo "[REMOTE] 重启服务..."
    cd "${REMOTE_PATH}"
    docker compose -f \${COMPOSE_FILE} down
    docker compose -f \${COMPOSE_FILE} up -d

    echo "[REMOTE] 清理旧镜像..."
    docker image prune -f

    echo "[REMOTE] 等待服务启动..."
    sleep 5

    echo "[REMOTE] 健康检查..."
    HTTP_CODE=\$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:\${HOST_PORT}/ 2>/dev/null || echo "000")
    if [[ "\${HTTP_CODE}" == "200" || "\${HTTP_CODE}" == "307" ]]; then
      echo "[REMOTE] ✅ 服务正常 → HTTP \${HTTP_CODE}"
    else
      echo "[REMOTE] ⚠️  服务异常 → HTTP \${HTTP_CODE}"
    fi
REMOTE_SCRIPT

  info "远程部署完成"
}

# ── NGINX ────────────────────────────────────────────────────────────
nginx_reload() {
  step "重载 NGINX..."
  if ! command -v nginx &>/dev/null; then
    warn "nginx 未安装，跳过"
    return
  fi
  nginx -t || error "NGINX 配置语法检查失败"
  nginx -s reload
  info "NGINX 已重载"
}

# ── 健康检查 ────────────────────────────────────────────────────────
health() {
  step "健康检查..."
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:${HOST_PORT}/ 2>/dev/null || echo "000")
  if [[ "${code}" == "200" || "${code}" == "307" ]]; then
    info "服务正常 → HTTP ${code} (localhost:${HOST_PORT})"
  else
    warn "服务异常 → HTTP ${code}"
  fi
}

# ── 一键全流程 ──────────────────────────────────────────────────────
full() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║     peom-soul 一键全流程部署          ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
  echo ""

  check_env

  # 1. 构建并推送
  push

  # 2. 远程部署
  remote_update

  # 3. 健康检查
  echo ""
  health

  echo ""
  info "部署完成 🚀"
  echo ""
  echo "  访问地址: https://ps.zzxun.cn/"
  echo ""
}

# ── 回滚 ────────────────────────────────────────────────────────────
rollback() {
  step "回滚 peom-soul..."

  # 查找上一个本地镜像
  local prev_image
  prev_image=$(docker images --format "{{.Repository}}:{{.Tag}} {{.CreatedAt}}" \
    | grep "${IMAGE_NAME}" | sort -k2 -r | head -2 | tail -1 | awk '{print $1}')

  if [[ -z "${prev_image}" ]]; then
    error "未找到上一个 ${IMAGE_NAME} 镜像，无法回滚"
  fi

  info "回滚到: ${prev_image}"
  docker tag "${prev_image}" ${IMAGE_NAME}:rollback 2>/dev/null || true

  ${COMPOSE_CMD} -f "${COMPOSE_FILE}" up -d --force-recreate

  nginx_reload
  health
  info "回滚完成"
}

# ── 清理 ────────────────────────────────────────────────────────────
clean() {
  step "清理旧镜像和停止的容器..."
  docker container prune -f
  docker image prune -f
  info "清理完成"
}

# ── 帮助 ────────────────────────────────────────────────────────────
show_help() {
  echo "peom-soul (诗魂) 部署脚本"
  echo ""
  echo "用法: $0 <命令> [参数]"
  echo ""
  echo "本地命令:"
  echo "  build           构建 Docker 镜像"
  echo "  start           启动服务 (docker compose up -d)"
  echo "  stop            停止服务"
  echo "  restart         重启服务"
  echo "  status          查看服务状态"
  echo "  logs            查看日志"
  echo "  health          健康检查 (本地 localhost:${HOST_PORT})"
  echo "  nginx-reload    重载 NGINX 配置"
  echo "  clean           清理旧镜像和停止的容器"
  echo ""
  echo "远程命令:"
  echo "  push            构建镜像 + 推送到 ${REGISTRY}"
  echo "  remote-update   SSH 远程服务器拉取镜像并重启"
  echo "  full            一键全流程: push → remote-update → health"
  echo "  rollback        回滚到上一个镜像版本"
  echo ""
  echo "环境变量:"
  echo "  REGISTRY         私有仓库地址 (默认: zzxun.cn:5000)"
  echo "  TAG              镜像标签 (默认: latest)"
  echo "  PEOM_PORT        宿主端口 (默认: 3006)"
  echo "  REMOTE_HOST      远程服务器地址 (默认: root@ps.zzxun.cn)"
  echo "  REMOTE_PATH      远程项目路径 (默认: /root/no-jobs/poem-soul)"
  echo ""
  echo "首次部署:"
  echo "  1. ./deploy.sh push                # 构建并推送镜像"
  echo "  2. ./deploy.sh remote-update        # 远程拉取并启动"
  echo ""
  echo "日常更新:"
  echo "  ./deploy.sh full                    # 一键全流程"
}

# ═══════════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════════

case "${1:-help}" in
  build)          build ;;
  start)          start ;;
  stop)           stop ;;
  restart)        restart ;;
  status)         status ;;
  logs)           logs ;;
  push)           push ;;
  remote-update)  remote_update ;;
  nginx-reload)   nginx_reload ;;
  health)         health ;;
  full)           full ;;
  rollback)       rollback ;;
  clean)          clean ;;
  help|--help|-h) show_help ;;
  *)
    echo "未知命令: $1"
    echo ""
    show_help
    exit 1
    ;;
esac
