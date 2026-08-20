# peom-soul（诗魂）部署文档

> 打包 / 部署 / nginx 配置，参照同机已上线的 **ai-hotbed**（demos.zzxun.cn）体系。
> 部署域名：**`https://ps.zzxun.cn`**（本阶段暂不涉及预约功能，仅做基础打包部署）。

---

## ⚠️ 0. 设计人员对接清单（部署前需逐条确认）

以下为部署脚本的**对接细节**，默认值已给出，请与设计 / 运维确认后再正式上线：

| # | 对接项 | 默认值 | 需确认内容 |
|---|--------|--------|-----------|
| 1 | **宿主端口** | `3006`（容器内 3000） | 确认未被其他服务占用；如需改动，需同步改 `docker-compose.yml`、`nginx/ps.conf`、`deploy.sh` 三处 `HOST_PORT` |
| 2 | **DNS 解析** | `ps.zzxun.cn` → 服务器 IP | 确认 A 记录已解析到该服务器 |
| 3 | **SSL 证书** | 复用 `*.zzxun.cn` 泛域名证书（`/etc/nginx/certs/acme/`） | 确认该通配证书已覆盖 `ps.zzxun.cn`；若未覆盖需先用 acme.sh 签发 |
| 4 | **私有仓库** | `zzxun.cn:5000/peom-soul:latest` | 确认目标机可 pull（`docker login zzxun.cn:5000` 或内网可达） |
| 5 | **远程路径** | `/root/no-jobs/poem-soul` | 确认远程目录存在且与 `deploy.sh` 的 `REMOTE_PATH` 一致 |
| 6 | **后续预约 / AI 功能是否需数据库** | 本轮不做 | 如需引入外部 DB，后续补 `.env`（`DATABASE_URL` 等）并更新 compose，不阻塞本轮部署 |

**nginx 反向代理关系：**
```
https://ps.zzxun.cn ──443──> nginx ──proxy──> 127.0.0.1:3006 ──:3000──> peom-soul 容器
```

---

## 1. 部署文件说明

| 文件 | 作用 |
|------|------|
| `docker/Dockerfile` | 多阶段构建（deps→builder→runner），无数据库，语料 `public/data` 随镜像 |
| `docker-compose.yml` | 服务编排：宿主 `3006` → 容器 `3000` |
| `deploy.sh` | 主部署脚本（build/start/stop/restart/status/logs/push/remote-update/full/rollback/clean/health/nginx-reload） |
| `deploy_update.sh` | 快速「构建 + 推送镜像」到私有仓库 |
| `deploy_remote.sh` | 服务器端「拉取镜像 + 重启 + 健康检查」 |
| `nginx/ps.conf` | `ps.zzxun.cn` 反向代理配置（HTTP→HTTPS + 443 反代 3006） |
| `.env.example` | 环境变量样例（本项目自包含，`.env` 非必需） |

---

## 2. 前置条件

- Docker + docker compose（服务器与构建机均需）
- 私有仓库 `zzxun.cn:5000` 可登录 / 可达
- `.env`（可选）：复制 `.env.example` 为 `.env`，仅需时修改 `NEXT_PUBLIC_BASE_URL` 等

```bash
cp .env.example .env   # 可选；无数据库可不建
```

---

## 3. 首次部署

```bash
# ① 本地：构建并推送镜像
./deploy_update.sh            # 或 ./deploy.sh push

# ② 服务器：拉取镜像并启动（本机直接跑）
./deploy_remote.sh            # 或 ./deploy.sh remote-update
#   - 若不同机，先 scp docker-compose.yml / .env 到远程 REMOTE_PATH，再执行 remote-update

# ③ 服务器：安装 nginx 配置
cp nginx/ps.conf /etc/nginx/sites-enabled/ps
nginx -t && nginx -s reload

# ④ 验证
curl -I https://ps.zzxun.cn/                 # 期望 200
curl 'http://localhost:3006/api/random'      # 期望 JSON
```

---

## 4. 日常更新

```bash
# 一键全流程：构建推送 → 远程拉取重启 → 健康检查
./deploy.sh full

# 或分步
./deploy_update.sh            # 构建 + 推送
./deploy_remote.sh            # 服务器拉取重启
```

---

## 5. 服务管理（本地命令）

```bash
./deploy.sh start|stop|restart|status|logs   # 常规运维
./deploy.sh health                           # 健康检查 localhost:3006
./deploy.sh rollback                         # 回滚上一个镜像
./deploy.sh clean                            # 清理旧镜像/容器
./deploy.sh nginx-reload                     # 重载 nginx
```

---

## 6. 健康检查约定

- **Docker HEALTHCHECK**（容器内）：`wget -qO- http://localhost:3000/api/random`
  > peom-soul 无 `/api/health`，故复用轻量真实接口 `/api/random`，不额外改代码。
- **外部存活**：`curl http://localhost:3006/`（宿主端口），`200` / `307` 视为正常。
- 以 `200` 为成功，其他（含重定向 `307`）也判为可达。

---

## 7. 回滚

```bash
./deploy.sh rollback    # 基于本地镜像列表找上一个版本并 force-recreate
```
> 若想按版本回滚，`docker pull zzxun.cn:5000/peom-soul:<tag>` 后 `docker compose up -d`。

---

## 8. 常见问题

- **`docker: repository ... not found`**：确认已 `docker login zzxun.cn:5000` 且镜像已推送。
- **启动后 502**：`docker compose logs --tail=50 peom-soul` 查应用日志；确认未占用 3006 端口（`ss -ltnp | grep 3006`）。
- **证书不匹配**：确认 `*.zzxun.cn` 泛域名证书覆盖域；否则用 acme.sh 为该域单独签发后替换 nginx 证书路径。
- **改端口**：同步修改 `.env`（`PEOM_PORT`）、`nginx/ps.conf`、`deploy.sh` 的默认 `HOST_PORT`。
