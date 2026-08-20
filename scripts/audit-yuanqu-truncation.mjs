#!/usr/bin/env node
/**
 * audit-yuanqu-truncation.mjs —— 元曲「曲牌・曲文」截断诊断脚本（只读）
 *
 * 背景：chinese-poetry 上游元曲数据里，一部分记录把曲文开头截断塞进了 title，
 * 形如  title="幺・柔肠脉脉，新愁千万叠。…"  paragraphs=["…冗长的结尾"]。
 * 这类记录（约 2000 条 / 全卷 11057）title 吞了曲文上半、content 只剩尾巴，
 * 展示层忠实显示后即表现为「标题很长 + 正文只剩半句·断句」。
 *
 * 本脚本【只做诊断，不修改 public/data】：
 *   1) 从 chinese-poetry 上游拉取 元曲/yuanqu.json（可用参数给定本地路径或缓存）
 *   2) 按 title 形态把记录分为正常 / 截断两组
 *   3) 对每条截断记录，给出「建议重组」：title=曲牌，content=曲文头+尾
 *   4) 产出人读报告 scripts/.audit/yuanqu-truncation.md + 机器清单 .json
 *
 * 用法：
 *   node scripts/audit-yuanqu-truncation.mjs [上游json路径] [--limit N]
 *   例：node scripts/audit-yuanqu-truncation.mjs
 *       node scripts/audit-yuanqu-truncation.mjs /tmp/yuanqu.json
 *       node scripts/audit-yuanqu-truncation.mjs /tmp/yuanqu.json --limit 30
 *
 * 说明：
 *   - 首次运行会自动从 GitHub raw 拉取上游文件并缓存到 scripts/.audit/cache/；
 *     之后优先用缓存（`--refresh` 强制重拉）。
 *   - 末尾的摘要即为「待人工确认的修复规模」；确认后另跑修复脚本（届时再写 public/data）。
 *   无第三方依赖：仅用 node:https / node:fs / node:path
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AUDIT_DIR = join(__dirname, ".audit");
const CACHE_DIR = join(AUDIT_DIR, "cache");
const CACHE_FILE = join(CACHE_DIR, "yuanqu.json");

// 上游源：chinese-poetry 仓库 元曲（中文目录名需 URL 编码）
const UPSTREAM_URL =
  "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/%E5%85%83%E6%9B%B2/yuanqu.json";

// 分隔符：上游混用「・」与「·」
const SEP_RE = /[・·]/;

// 句读标点：分隔符后出现这些 → 说明后段是曲文（被截断的正文开头），而非宫调/曲牌名
const READING_RE = /[，。？！、；：…]/u;

/** 简单的 https GET，若响应过长则丢弃；返回 body 文本 */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 45000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    }).on("error", reject).on("timeout", () => reject(new Error(`timeout for ${url}`)));
  });
}

/** 读取上游元曲记录：优先本地参数 → 缓存 → 网络拉取 */
async function loadUpstream(explicitPath, opts) {
  if (explicitPath) {
    return JSON.parse(readFileSync(explicitPath, "utf-8"));
  }
  if (!opts.refresh && existsSync(CACHE_FILE)) {
    console.log(`[cache] 使用缓存 ${CACHE_FILE}`);
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`[fetch] 拉取上游 ${UPSTREAM_URL}`);
  const body = await httpsGet(UPSTREAM_URL);
  if (!Array.isArray(JSON.parse(body))) {
    throw new Error("上游返回非数组，中止");
  }
  writeFileSync(CACHE_FILE, body, "utf-8");
  console.log(`[cache] 已写入 ${CACHE_FILE}`);
  return JSON.parse(body);
}

/** 判断一条记录是否「曲牌・曲文」截断 */
function classify(rec) {
  const title = String(rec.title ?? "");
  const m = title.match(SEP_RE);
  const content = String(rec.content ?? "")
    || ((rec.paragraphs ?? []) || []).join("");

  if (!m) {
    // 无分隔符：纯曲牌，正文全在 content —— 正常
    return { truncated: false, kind: "plain", qupai: title, head: "", tail: content };
  }

  const qupai = title.slice(0, m.index).trim();
  const rest = title.slice(m.index + 1).trim(); // 分隔符后

  if (READING_RE.test(rest)) {
    // 分隔符后是曲文（含句读）→ 截断
    const tail = content.trim();
    // 建议重组：title=曲牌，content=曲文头+尾
    const fixedContent = rest + tail;
    return { truncated: true, kind: "broken", qupai, head: rest, tail, fixedContent };
  }

  // 分隔符后是宫调/曲牌名（无句读）→ 正常（剧名・宫调/曲牌）
  return { truncated: false, kind: "play", qupai, head: "", tail: content };
}

/** 是否已有本地对应曲牌/能推断（修复时用；诊断阶段仅提示） */
async function main() {
  const args = process.argv.slice(2);
  const pathArg = args.find((a) => !a.startsWith("--"));
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null;
  const refresh = args.includes("--refresh");

  const upstream = await loadUpstream(pathArg, { refresh });
  if (!Array.isArray(upstream)) throw new Error("上游数据不是数组");

  const broken = [];
  const plain = [];
  const play = [];

  for (const [idx, rec] of upstream.entries()) {
    // 预测 id：与 build-data.mjs 的 makeId 约定一致（集 key + 序号的零填充 6 位）
    const projectedId = `yuanqu-${String(idx + 1).padStart(6, "0")}`;
    const r = classify(rec);
    const entry = { rec, projectedId, ...r };
    (r.truncated ? broken : r.kind === "play" ? play : plain).push(entry);
  }

  // —— 写出人读报告 ——
  mkdirSync(AUDIT_DIR, { recursive: true });
  const mdLines = [];
  mdLines.push(`# 元曲截断诊断报告（只读，未改动数据）`);
  mdLines.push(``);
  mdLines.push(`- 上游总量：${upstream.length}`);
  mdLines.push(`- 正常·纯曲牌：${plain.length}`);
  mdLines.push(`- 正常·剧名/宫调·曲牌：${play.length}`);
  mdLines.push(`- **疑似截断（title 吞曲文开头）：${broken.length}**`);
  mdLines.push(`- 生成时间：(运行脚本时）`);
  mdLines.push(``);
  mdLines.push(`> 截断规则：title 形如「曲牌・曲文内容…」（分隔符后有句读标点），`);
  mdLines.push(`> content/paragraphs 只剩曲文结尾。建议重组为 title=曲牌、content=曲文头+尾。`);
  mdLines.push(``);

  const shown = limit ?? broken.length;
  mdLines.push(`## 疑似截断明细（前 ${shown} / ${broken.length} 条）`);
  mdLines.push(``);
  for (let i = 0; i < Math.min(shown, broken.length); i++) {
    const b = broken[i];
    mdLines.push(`### ${i + 1}. ${b.projectedId} · ${b.qupai} · ${b.rec.author ?? "?"}`);
    mdLines.push(`- 现状 title：\`${b.head.slice(0, 60)}${b.head.length > 60 ? "…" : ""}\` …`);
    mdLines.push(`- 现状 content 尾：\`${b.tail.slice(0, 60)}${b.tail.length > 60 ? "…" : ""}\``);
    mdLines.push(`- 建议 title：\`${b.qupai}\``);
    mdLines.push(`- 建议 content：\`${b.fixedContent.slice(0, 80)}${b.fixedContent.length > 80 ? "…" : ""}\``);
    mdLines.push(``);
  }
  writeFileSync(join(AUDIT_DIR, "yuanqu-truncation.md"), mdLines.join("\n"), "utf-8");

  // —— 机器读清单（全量） ——
  const machine = {
    generatedAt: "run-time", // 由运行环境补时间戳
    upstreamTotal: upstream.length,
    counts: { plain: plain.length, play: play.length, broken: broken.length },
    repairRule: "title=曲牌；content=分隔符后曲文头 + content 尾巴",
    broken: broken.map((b) => ({
      id: b.projectedId,
      author: b.rec.author ?? "",
      dynasty: b.rec.dynasty ?? "",
      qupai: b.qupai,
      currentTitle: b.head,
      currentContentTail: b.tail,
      proposedTitle: b.qupai,
      proposedContent: b.fixedContent,
    })),
  };
  writeFileSync(
    join(AUDIT_DIR, "yuanqu-truncation.json"),
    JSON.stringify(machine, null, 2),
    "utf-8"
  );

  // —— 摘要 ——
  console.log(`\n═══ 元曲截断诊断 ═══`);
  console.log(`上游总量      : ${upstream.length}`);
  console.log(`正常·纯曲牌   : ${plain.length}`);
  console.log(`正常·剧名/曲牌: ${play.length}`);
  console.log(`疑似截断(待人工确认): ${broken.length}`);
  console.log(`\n报告: scripts/.audit/yuanqu-truncation.md`);
  console.log(`清单: scripts/.audit/yuanqu-truncation.json`);
  console.log(`\n⚠️  本脚本只读，未改动 public/data。`);
  console.log(`确认修复规模后，可据此生成修复脚本（届时才写 public/data）。`);
}

main().catch((e) => {
  console.error("诊断失败：", e.message);
  process.exit(1);
});
