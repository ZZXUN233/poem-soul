#!/usr/bin/env node
/**
 * sync-classic-upstream.mjs —— 从 chinese-poetry 上游重建全部古体诗数据
 *
 * 背景：本项目原来自 Android 母工程（../app/src/main/assets/corpus）清洗语料，
 * 存在 ①依赖外部工程 ②元曲 title 截断（约 2000 条）等问题。
 * 本脚本改为**直接以 chinese-poetry 上游仓库为唯一数据源**，重建 public/data/classic/：
 *
 *   - 拉取 8 古体诗卷（全唐诗/宋词/元曲/诗经/楚辞/曹操/纳兰清词/五代词）
 *   - 全唐诗做 繁→简 转换（opencc-js，仅构建时用；运行库零依赖）
 *   - 修复元曲「曲牌・曲文」截断
 *   - 全唐诗按句数/字数推断体裁（五/七言 × 绝句/律诗/古体）
 *   - 按固定顺序生成稳定 id（`<key>-000001`），id 随上游序稳定
 *   - 输出 meta.json / poems/*.json / index/search.json，布局与旧 build-data 一致
 *
 * 用法：
 *   node scripts/sync-classic-upstream.mjs [--refresh] [--dry-run]
 *   --refresh   强制重新拉取上游（默认用缓存）
 *   --dry-run   只拉到缓存并统计，不写 public/data
 *
 * 说明：
 *   - 缓存位于 .gitignore 的 scripts/.cache/upstream/
 *   - 依赖 opencc-js（devDependency，仅数据再生成时用；提交的 public/data 自包含）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import { Converter } from "opencc-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data", "classic");
const POEMS_DIR = join(DATA_DIR, "poems");
const INDEX_DIR = join(DATA_DIR, "index");
const CACHE_DIR = join(ROOT, "scripts", ".cache", "upstream");

const UPSTREAM_BASE =
  "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master";

/* ============================================================
   源定义：每卷的目录 + 文件清单生成函数
   ============================================================ */
const UPC = (s) => encodeURIComponent(s); // URL 编码目录
// 全唐诗：poet.tang.<N>.json，N=0..57000 步 1000
const tangFiles = () =>
  Array.from({ length: 58 }, (_, i) => `poet.tang.${i * 1000}.json`);
// 宋词：ci.song.<N>.json，N=0..21000 步 1000（跳过特殊 2019y）
const ciFiles = () =>
  Array.from({ length: 22 }, (_, i) => `ci.song.${i * 1000}.json`);
// 五代：nantang + 花间集各卷
const wudaiFiles = () => [
  `nantang/poetrys.json`,
  `huajianji/huajianji-0-preface.json`,
  `huajianji/huajianji-1-juan.json`,
  `huajianji/huajianji-2-juan.json`,
  `huajianji/huajianji-3-juan.json`,
  `huajianji/huajianji-4-juan.json`,
  `huajianji/huajianji-5-juan.json`,
  `huajianji/huajianji-6-juan.json`,
  `huajianji/huajianji-7-juan.json`,
  `huajianji/huajianji-8-juan.json`,
  `huajianji/huajianji-9-juan.json`,
  `huajianji/huajianji-x-juan.json`,
];

// 各卷：dir（相对仓库根，URL 编码）、文件名清单、是否繁体需转简、映射标签
const SOURCES = [
  { key: "tang",    dir: "全唐诗",        files: tangFiles, t2s: true,  meta: { dynasty: "唐", formFile: true } },
  { key: "song_ci", dir: "宋词",          files: ciFiles,   t2s: false, meta: { dynasty: "宋", form: "词" } },
  { key: "yuanqu",  dir: "元曲",          files: () => ["yuanqu.json"], t2s: false, meta: { dynasty: "元", form: "曲", repair: true } },
  { key: "shijing", dir: "诗经",          files: () => ["shijing.json"], t2s: false, meta: { dynasty: "周", form: "诗经" } },
  { key: "chuci",   dir: "楚辞",          files: () => ["chuci.json"], t2s: false, meta: { dynasty: "先秦", form: "楚辞" } },
  { key: "caocao",  dir: "曹操诗集",      files: () => ["caocao.json"], t2s: false, meta: { dynasty: "汉", form: "乐府诗", author: "曹操" } },
  { key: "qing",    dir: "纳兰性德",      files: () => ["纳兰性德诗集.json"], t2s: false, meta: { dynasty: "清", form: "词" } },
  { key: "wudai",   dir: "五代诗词",      files: wudaiFiles, t2s: false, meta: { dynasty: "五代", form: "词" } },
];

const COLLECTION_LABELS = {
  tang: "全唐诗", song_ci: "宋词", yuanqu: "元曲", shijing: "诗经",
  chuci: "楚辞", caocao: "曹操集", qing: "清词（纳兰性德）", wudai: "五代词",
};

// 精选种子（书架初始）：按 上游准确题目+作者 匹配；展示用干净标题。
// match 缺省同 title；个别上游题目有变体（去“送”、带序、词牌带异名）时显式给出。
const SEED_LOOKUPS = [
  { title: "静夜思",              author: "李白" },
  { title: "登鹳雀楼",            author: "王之涣" },
  { title: "春晓",                author: "孟浩然" },
  { title: "望庐山瀑布",          author: "李白", match: "望庐山瀑布水二首二" },
  { title: "早发白帝城",          author: "李白" },
  { title: "山行",                author: "杜牧" },
  { title: "春望",                author: "杜甫" },
  { title: "送杜少府之任蜀州",    author: "王勃", match: "杜少府之任蜀州" },
  { title: "登高",                author: "杜甫" },
  { title: "一剪梅",              author: "李清照", match: "一剪梅・一翦梅" },
];

/** 生成精选种子集（poems-000001..）：精确匹配上游题目+作者，输出干净标题 */
function buildSeeds(allPoems) {
  const byKey = new Map();
  for (const p of allPoems) byKey.set(`${p.title}|${p.author}`, p);
  const seeds = [];
  for (const s of SEED_LOOKUPS) {
    const key = `${s.match ?? s.title}|${s.author}`;
    const hit = byKey.get(key);
    if (!hit) {
      console.warn(`  [seed] 未匹配到: ${s.title} · ${s.author}（跳过）`);
      continue;
    }
    seeds.push({ ...hit, id: "", title: s.title }); // title 用干净展示题
  }
  // 顺序重编号 000001..
  seeds.forEach((p, i) => { p.id = `poems-${String(i + 1).padStart(6, "0")}`; });
  return seeds;
}

/** https GET → body 文本；404 返回 null */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode === 404) { res.resume(); return resolve(null); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} ${url}`)); }
      const buf = [];
      res.on("data", (c) => buf.push(c));
      res.on("end", () => resolve(Buffer.concat(buf).toString("utf-8")));
    }).on("error", reject);
  });
}

const SEP_RE = /[・·]/;
const READING_RE = /[，。？！、；：…]/u;
const LINE_END_RE = /[。？！；]/;

/** 一键取文件：缓存优先；--refresh 强制重拉 */
let refreshFlag = false;
async function fetchFile(dirEnc, filename) {
  const outPath = join(CACHE_DIR, dirEnc, filename);
  if (!refreshFlag && existsSync(outPath)) {
    return JSON.parse(readFileSync(outPath, "utf-8"));
  }
  const url = `${UPSTREAM_BASE}/${dirEnc}/${upe(filename)}`;
  const body = await httpsGet(url);
  if (body == null) return null; // 404 → 跳过该文件
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, body, "utf-8");
  return JSON.parse(body);
}

// URL 编码路径段（不含 "/"）
const upe = (s) => s.split("/").map(encodeURIComponent).join("/");

/** 推断全唐诗体裁：五/七言 × 绝句(4分句)/律诗(8分句)/古体 */
function inferTangForm(content) {
  // 按分句切（逗号/句号/叹/问/分号都算句末；顿号/冒号仅作停顿，不计新句）
  const clauses = content
    .split(/[，。！？；]/)
    .map((s) => s.replace(/[、：]/g, ""))
    .filter((s) => s.length > 0);
  if (clauses.length === 0) return "";
  const lens = clauses.map((s) => [...s].length);

  // 主行字数（中位数）判断五/七言；并要求句句齐整（有偶尔偏长/偏短则按古体）
  const sorted = [...lens].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  let chars = null;
  if (med <= 5 && lens.every((l) => l >= 4 && l <= 6)) chars = "五";
  else if (med >= 7 && lens.every((l) => l >= 6 && l <= 8)) chars = "七";
  else return "古体诗";

  const n = clauses.length;
  if (n === 4) return `${chars}言绝句`;
  if (n === 8) return `${chars}言律诗`;
  return "古体诗";
}

/** 简易去空白兜底 */
const cleanStr = (s) => (s ?? "").replace(/\s+/g, "").trim();

/* ============================================================
   主流程
   ============================================================ */
async function main() {
  const args = process.argv.slice(2);
  refreshFlag = args.includes("--refresh");
  const dryRun = args.includes("--dry-run");

  // 繁→简转换器（仅对 t2s 卷启用）
  let toSimp = null;
  if (SOURCES.some((s) => s.t2s)) toSimp = Converter({ from: "t", to: "cn" });

  const allPoems = [];
  console.log("═══ 从 chinese-poetry 上游重建古体诗数据 ═══");

  for (const src of SOURCES) {
    const dirEnc = UPC(src.dir);
    const files = src.files();
    const records = [];
    let emptyFiles = 0;
    for (const f of files) {
      const data = await fetchFile(dirEnc, f);
      if (data == null) { emptyFiles++; continue; }
      const list = Array.isArray(data) ? data : data ? [data] : [];
      for (const r of list) {
        // 繁→简：全唐诗整体转换
        const rec = src.t2s && toSimp ? t2sRecord(r, toSimp, src.key) : r;
        records.push(rec);
      }
    }
    // 序号分配 id
    const poems = records
      .map((raw, i) => mapRecord(src, raw, i))
      .filter(Boolean);
    allPoems.push(...poems);
    console.log(
      `  ${src.key.padEnd(8)} 文件${files.length}跳过${emptyFiles} 记录 ${records.length} → ${poems.length} 首`
    );
  }

  // 汇总校验
  const total = allPoems.length;
  const totalChars = allPoems.reduce((n, p) => n + (p.content?.length ?? 0), 0);
  const collections = SOURCES.map((s) => {
    const items = allPoems.filter((p) => p.id.startsWith(s.key + "-"));
    return {
      key: s.key,
      label: COLLECTION_LABELS[s.key],
      count: items.length,
      dynasties: [...new Set(items.map((p) => p.dynasty).filter(Boolean))].sort(),
      forms: [...new Set(items.map((p) => p.form).filter(Boolean))].sort(),
    };
  });

  console.log(`\n汇总: ${total} 首 / ${totalChars} 字`);

  if (dryRun) {
    console.log("(--dry-run) 未写 public/data。缓存已就绪。");
    return;
  }

  // 重建输出（布局与旧 build-data 一致）
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(POEMS_DIR, { recursive: true });
  mkdirSync(INDEX_DIR, { recursive: true });

  for (const c of collections) {
    const items = allPoems.filter((p) => p.id.startsWith(c.key + "-"));
    writeFileSync(join(POEMS_DIR, `${c.key}.json`), JSON.stringify(items), "utf-8");
  }

  // 精选种子集（书架初始）：按 title+author 查回，preserve 内容
  const seeds = buildSeeds(allPoems);
  writeFileSync(join(POEMS_DIR, "poems.json"), JSON.stringify(seeds), "utf-8");
  if (seeds.length) console.log(`  [seed] 已生成精选种子 ${seeds.length} 首 → poems.json`);

  // 搜索索引（正排，供 /api/search 线性扫描）
  const searchIndex = allPoems.map((p) => ({
    id: p.id, title: p.title, author: p.author,
    dynasty: p.dynasty, form: p.form, content: p.content,
  }));
  writeFileSync(join(INDEX_DIR, "search.json"), JSON.stringify(searchIndex), "utf-8");

  const meta = {
    version: 1,
    generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    source: "chinese-poetry (upstream, sync-classic-upstream.mjs)",
    totalPoems: total,
    totalChars,
    allDynasties: [...new Set(allPoems.map((p) => p.dynasty).filter(Boolean))].sort(),
    allForms: [...new Set(allPoems.map((p) => p.form).filter(Boolean))].sort(),
    collections,
  };
  writeFileSync(join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

  console.log("✅ 已重建 public/data/classic/ (meta.json + poems/*.json + index/search.json)");
}

/** 繁→简整条记录：title/author/content 字段转简 */
function t2sRecord(r, toSimp, key) {
  const out = { ...r };
  if (typeof out.title === "string") out.title = toSimp(out.title);
  if (typeof out.author === "string") out.author = toSimp(out.author);
  if (Array.isArray(out.paragraphs)) out.paragraphs = out.paragraphs.map((s) => toSimp(s));
  if (Array.isArray(out.content)) out.content = out.content.map((s) => toSimp(s));
  if (Array.isArray(out.para)) out.para = out.para.map((s) => toSimp(s));
  return out;
}

/** 单卷记录 → Poem（按卷定制映射） */
function mapRecord(src, raw, i) {
  const id = `${src.key}-${String(i + 1).padStart(6, "0")}`;
  const m = src.meta;
  const paragraphs = raw.paragraphs ?? raw.content ?? raw.para ?? [];
  const joinContent = (arr) => (Array.isArray(arr) ? arr.join("") : String(arr ?? ""));

  if (src.key === "tang") {
    const content = cleanStr(joinContent(paragraphs));
    return {
      id, title: cleanStr(raw.title), author: cleanStr(raw.author),
      dynasty: "唐", form: inferTangForm(content), content,
    };
  }
  if (src.key === "song_ci") {
    // 上游 ci.song 无 title，词牌在 rhythmic
    return {
      id, title: cleanStr(raw.rhythmic) || raw.title || "",
      author: cleanStr(raw.author), dynasty: "宋", form: "词",
      content: cleanStr(joinContent(paragraphs)),
    };
  }
  if (src.key === "yuanqu") {
    return mapYuanqu(id, raw);
  }
  if (src.key === "caocao") {
    return {
      id, title: cleanStr(raw.title), author: m.author || cleanStr(srcauthor(raw)),
      dynasty: m.dynasty, form: m.form, content: cleanStr(joinContent(paragraphs)),
    };
  }
  if (src.key === "shijing") {
    return {
      id, title: cleanStr(raw.title), author: "",
      dynasty: m.dynasty, form: m.form, content: cleanStr(joinContent(paragraphs)),
    };
  }
  return {
    id, title: cleanStr(raw.title),
    author: cleanStr(raw.author) || (src.key === "qing" ? "纳兰性德" : ""),
    dynasty: m.dynasty, form: m.form, content: cleanStr(joinContent(paragraphs)),
  };
}

// narrow helper
const srcauthor = (raw) => raw.author ?? "";

/** 元曲：修复「曲牌・曲文」截断 */
function mapYuanqu(id, raw) {
  const m = String(raw.title ?? "");
  const paras = (raw.paragraphs ?? []) || [];
  const tail = cleanStr(paras.join(""));
  const sep = m.match(SEP_RE);

  let title, content;
  if (!sep) {
    // 纯曲牌，正文全在 paragraphs
    title = cleanStr(m);
    content = tail;
  } else {
    const qupai = m.slice(0, sep.index).trim();
    const rest = m.slice(sep.index + 1).trim();
    if (READING_RE.test(rest)) {
      // 截断：title=曲牌，content=曲文头 + 尾
      title = qupai;
      content = cleanStr(rest + tail);
    } else {
      // 剧名・宫调/曲牌（未截断），正文在 paragraphs
      title = cleanStr(m);
      content = tail;
    }
  }
  return { id, title, author: cleanStr(raw.author), dynasty: "元", form: "曲", content };
}

main().catch((e) => { console.error("失败：", e); process.exit(1); });
