#!/bin/bash
# ============================================================================
# peom-soul (诗魂) — Docker 构建、打标签、推送到私有仓库
# 对标 ai-hotbed/deploy_update.sh 模式
#
# 用法:
#   ./deploy_update.sh           构建并推送 latest
#   ./deploy_update.sh v1.2.3    构建并推送指定版本
# ============================================================================

set -e

IMAGE_NAME="peom-soul"
REGISTRY="zzxun.cn:5000"
TAG="${1:-latest}"
DOCKERFILE="docker/Dockerfile"

echo "🚀 peom-soul (诗魂) — 部署开始..."
echo ""

# 读取 .env 获取构建参数（安全解析，逐行处理避免特殊字符问题）；无 .env 则跳过
if [ -f .env ]; then
  set -a
  while IFS= read -r line; do
    # 跳过空行和纯注释行
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    # 提取 KEY=VALUE
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"
      # 去除首尾空白和可选的外层引号（单引或双引）
      value="$(echo "$value" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
      if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < .env
  set +a
else
  echo "⚠️  未检测到 .env（本项目无数据库，默认配置可正常构建）"
fi

# 构建 Docker 镜像
echo "📦 构建 Docker 镜像 (${IMAGE_NAME}:${TAG})..."
docker build \
  -f ${DOCKERFILE} \
  -t ${IMAGE_NAME}:${TAG} .

# 打标签
echo "🏷️  打标签..."
docker tag ${IMAGE_NAME}:${TAG} ${REGISTRY}/${IMAGE_NAME}:${TAG}

# 推送到私有仓库
echo "📤 推送到私有仓库..."
docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}

echo ""
echo "✅ 推送完成！"
echo "镜像地址: ${REGISTRY}/${IMAGE_NAME}:${TAG}"
echo ""
echo "远程服务器拉取并运行："
echo "  docker pull ${REGISTRY}/${IMAGE_NAME}:${TAG}"
echo "  docker compose -f docker-compose.yml up -d"
echo ""
echo "或使用远程部署命令："
echo "  ./deploy.sh remote-update"
