#!/usr/bin/env node
/**
 * build-data.mjs —— 诗魂 Web 语料迁移脚本
 *
 * 读取 Android 侧已清洗语料（app/src/main/assets/corpus/*.json.gz 及 poems.json），
 * 解压、分配稳定 id、按集拆分，产出 Web 项目 public/data/ 下的：
 *   - meta.json          全局概览（各集记录数 / 朝代 / 体裁）
 *   - poems/<set>.json   每集一个 JSON 数组（完整 Poem 记录，可供阅读页/浏览）
 *   - index/search.json  全文搜索索引（保留 content 供服务端线性扫描）
 *
 * 用法：node scripts/build-data.mjs   （在 peom-soul/ 目录下运行）
 * 无第三方依赖：仅用 node:zlib / node:fs / node:path
 */

import { gunzipSync } from "node:zlib";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// peom-soul/ 根目录
const ROOT = join(__dirname, "..");
// 语料源（母工程 Android assets）
const CORPUS_SRC = join(ROOT, "..", "app", "src", "main", "assets", "corpus");
// 输出根
const DATA_DIR = join(ROOT, "public", "data");
const POEMS_DIR = join(DATA_DIR, "poems");
const INDEX_DIR = join(DATA_DIR, "index");

/** 各集展示名（key -> label），key 取源文件名去扩展名 */
const COLLECTION_LABELS = {
  tang: "全唐诗",
  song_ci: "宋词",
  yuanqu: "元曲",
  wudai: "五代词",
  shijing: "诗经",
  qing: "清词（纳兰性德）",
  chuci: "楚辞",
  caocao: "曹操集",
  poems: "精选种子",
};

/**
 * 生成稳定 id：集 key + 序号（零填充 6 位）。
 * 序号 = 该集内源数组下标，源顺序稳定 => id 稳定（只要源语料不变）。
 */
function makeId(setKey, index) {
  return `${setKey}-${String(index + 1).padStart(6, "0")}`;
}

/** 读取单个语料文件：.gz 解压，.json 直接读；返回 { key, label, records } */
function loadCorpusFile(filename) {
  const isGz = filename.endsWith(".json.gz");
  const base = filename.replace(/\.gz$/, "");
  const key = base.replace(/\.json$/, "");
  const label = COLLECTION_LABELS[key] ?? key;

  let jsonText;
  if (isGz) {
    const buf = readFileSync(join(CORPUS_SRC, filename));
    jsonText = gunzipSync(buf).toString("utf-8");
  } else {
    jsonText = readFileSync(join(CORPUS_SRC, filename), "utf-8");
  }
  const records = JSON.parse(jsonText);
  if (!Array.isArray(records)) {
    throw new Error(`语料文件 ${filename} 顶层不是数组`);
  }
  return { key, label, records };
}

/** 去空白/去空字符串的工具（content 已清洗，这里仅作兜底） */
function cleanStr(s) {
  return (s ?? "").replace(/\s+/g, "").trim();
}

function main() {
  console.log(`语料源目录: ${CORPUS_SRC}`);
  if (!readdirSync(CORPUS_SRC).length) {
    console.error(`! 未找到语料文件，请确认 ${CORPUS_SRC} 存在`);
    process.exit(1);
  }

  // 清理旧产物，保证确定性
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(POEMS_DIR, { recursive: true });
  mkdirSync(INDEX_DIR, { recursive: true });

  const sourceFiles = readdirSync(CORPUS_SRC)
    .filter((f) => f.endsWith(".json") || f.endsWith(".json.gz"))
    .sort();

  const collections = [];
  let totalPoems = 0;
  let totalChars = 0;
  const allDynasties = new Set();
  const allForms = new Set();

  for (const filename of sourceFiles) {
    const { key, label, records } = loadCorpusFile(filename);

    // 逐条转换：补 id、清洗字段
    const poems = records.map((raw, i) => {
      const poem = {
        id: makeId(key, i),
        title: cleanStr(raw.title),
        author: cleanStr(raw.author),
        dynasty: cleanStr(raw.dynasty),
        form: cleanStr(raw.form),
        content: cleanStr(raw.content),
      };
      totalChars += poem.content.length;
      return poem;
    });

    const dynasties = [...new Set(poems.map((p) => p.dynasty).filter(Boolean))].sort();
    const forms = [...new Set(poems.map((p) => p.form).filter(Boolean))].sort();
    dynasties.forEach((d) => allDynasties.add(d));
    forms.forEach((f) => allForms.add(f));

    // 写按集完整记录（供阅读页 / 浏览）
    writeFileSync(
      join(POEMS_DIR, `${key}.json`),
      JSON.stringify(poems),
      "utf-8"
    );

    collections.push({ key, label, count: poems.length, dynasties, forms });
    totalPoems += poems.length;
    console.log(`  ${key.padEnd(8)} ${String(poems.length).padStart(6)} 首  朝代[${dynasties.join("/")}]  体裁[${forms.join("/")} 或空]`);
  }

  // 全文搜索索引：核心字段正排，供服务端 /api/search 线性扫描
  const searchIndex = collections.flatMap((c) => {
    const poems = JSON.parse(readFileSync(join(POEMS_DIR, `${c.key}.json`), "utf-8"));
    return poems.map((p) => ({
      id: p.id,
      title: p.title,
      author: p.author,
      dynasty: p.dynasty,
      form: p.form,
      content: p.content,
    }));
  });
  writeFileSync(join(INDEX_DIR, "search.json"), JSON.stringify(searchIndex), "utf-8");

  // 全局 meta
  const meta = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalPoems,
    totalChars,
    allDynasties: [...allDynasties].sort(),
    allForms: [...allForms].sort(),
    collections,
  };
  writeFileSync(join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

  console.log("\n===== 完成 =====");
  console.log(`总首数:    ${totalPoems.toLocaleString()}`);
  console.log(`正文字数:  ${totalChars.toLocaleString()}`);
  console.log(`祖先代:    ${meta.allDynasties.join(" / ")}`);
  console.log(`产出:      ${DATA_DIR}/ (poems/ + index/search.json + meta.json)`);
  console.log(`搜索索引:  ${INDEX_DIR}/search.json (~${Math.round(JSON.stringify(searchIndex).length / 1024)} KB)`);
}

main();
