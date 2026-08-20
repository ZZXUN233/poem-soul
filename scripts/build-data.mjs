#!/usr/bin/env node
/**
 * build-data.mjs —— 古诗词数据构建入口（已弃用 Android 源，委托到上游同步）
 *
 * 历史：本文件原来自 Android 母工程（../app/src/main/assets/corpus）清洗语料。
 * 现古诗词数据源已迁移至 chinese-poetry 上游仓库，真正的构建逻辑在：
 *   scripts/sync-classic-upstream.mjs
 *
 * 本文件仅作转发，保留 `npm run build:data` / `npm run build:all` 的既有入口，
 * 避免破坏 README 与既有命令。直接执行即等价于：
 *   node scripts/sync-classic-upstream.mjs
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const syncScript = join(__dirname, "sync-classic-upstream.mjs");

const r = spawnSync(process.execPath, [syncScript, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (r.error) {
  console.error("无法运行 sync-classic-upstream.mjs：", r.error.message);
  process.exit(1);
}
process.exit(r.status ?? 1);
