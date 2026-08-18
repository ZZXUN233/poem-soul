#!/usr/bin/env node
/**
 * build-modern.mjs —— 诗魂 Web 现代诗数据迁移脚本
 *
 * 数据源：sheepzh/poetry（https://github.com/sheepzh/poetry，MIT）
 *   - 纯文本 .pt 文件，位于 data/[诗人名]_[拼音]/*.pt
 *   - 文件头 title:/date:，空行后为正文（正文依赖换行分行）
 *
 * 流程：
 *   1. 若缓存缺失，下载源仓库 master tarball（约 47MB）到 scripts/.cache/sheepzh/
 *   2. tar 解出 data/，遍历按诗人生成解析 .pt → Poem
 *   3. 产出 public/data/modern/：meta.json + poems/xian_dai.json + index/search.json
 *
 * 用法：node scripts/build-modern.mjs   （在 peom-soul/ 目录下运行）
 * 依赖：node 内置模块 + 系统 tar
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync, createWriteStream } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data", "modern");
const POEMS_DIR = join(DATA_DIR, "poems");
const INDEX_DIR = join(DATA_DIR, "index");

const CACHE_DIR = join(__dirname, ".cache", "sheepzh");
const TARBALL = join(CACHE_DIR, "master.tar.gz");
const EXTRACT_DIR = join(CACHE_DIR, "extracted");
const DATA_SRC = join(EXTRACT_DIR, "poetry-master", "data");

const TARBALL_URL = "https://github.com/sheepzh/poetry/archive/refs/heads/master.tar.gz";
const SET_KEY = "xian_dai";
const SET_LABEL = "现代诗";
const DYNASTY = "现代";
const FORM = "现代诗";

/** 生成稳定 id：xian_dai-000000（源遍历顺序稳定 => id 稳定） */
function makeId(index) {
  return `${SET_KEY}-${String(index + 1).padStart(6, "0")}`;
}

/** 下载 tarball（跟随重定向） */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`下载失败: HTTP ${res.statusCode}`));
          return;
        }
        const out = createWriteStream(dest);
        res.pipe(out);
        out.on("finish", resolve);
        out.on("error", reject);
      })
      .on("error", reject);
  });
}

/** 确保已下载并解压数据 */
async function ensureSource() {
  mkdirSync(CACHE_DIR, { recursive: true });

  if (!existsSync(TARBALL) || statSync(TARBALL).size < 1_000_000) {
    console.log(`下载源数据… ${TARBALL_URL}`);
    if (existsSync(TARBALL)) rmSync(TARBALL, { force: true });
    await download(TARBALL_URL, TARBALL);
    if (!existsSync(TARBALL)) throw new Error("下载源数据失败，请检查网络后重试");
  } else {
    console.log("源数据 tarball 已缓存，跳过下载。");
  }

  if (!existsSync(DATA_SRC)) {
    rmSync(EXTRACT_DIR, { recursive: true, force: true });
    mkdirSync(EXTRACT_DIR, { recursive: true });
    console.log("解压数据…");
    execFileSync("tar", ["-xzf", TARBALL, "-C", EXTRACT_DIR], { stdio: "inherit" });
  }

  if (!existsSync(DATA_SRC)) {
    throw new Error(`未找到数据目录 ${DATA_SRC}`);
  }
}

/** 取诗人目录名里的中文名（"海子_haizi" → "海子"）；清理后为空则回退原目录名 */
function poetNameFromDir(dirName) {
  const m = /^(.+?)_[\s\S]*$/.exec(dirName);
  const name = (m ? m[1].trim() : dirName.trim()).replace(/^\d+\s*/, "").trim();
  return name || dirName.trim();
}

/** 清洗正文：裁首尾空行，压缩 2 个以上连续空行为 1，行尾去空白 */
function cleanModernContent(body) {
  let s = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.split("\n").map((l) => l.replace(/\s+$/g, "")).join("\n");
  s = s.replace(/^\n+/, "").replace(/\n+$/, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

/** 解析单个 .pt 文件内容 → { title, year, content } */
function parsePt(text, filenameBase) {
  const lines = text.split(/\r?\n/);
  let title = "";
  let year = "";
  let bodyStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("title:")) {
      if (!title) title = line.slice("title:".length).trim();
      continue;
    }
    if (line.startsWith("date:")) {
      const d = line.slice("date:".length).trim();
      const m = /^(\d{4})/.exec(d);
      if (m) year = m[1];
      continue;
    }
    if (line.trim() === "" && title !== "") {
      bodyStart = i + 1;
      break;
    }
    if (line.trim() !== "") {
      // 容错：无空行分隔时，正文从这里开始
      bodyStart = i;
      break;
    }
  }

  if (bodyStart === -1) bodyStart = lines.length;
  const content = cleanModernContent(lines.slice(bodyStart).join("\n"));

  if (!title) {
    title = filenameBase
      .replace(/_节选$/, "")
      .replace(/：.+$/, "")
      .replace(/:.+$/, "")
      .trim();
  }
  return { title, year, content };
}

async function main() {
  console.log(`输出根: ${DATA_DIR}`);
  await ensureSource();
  const poetDirs = readdirSync(DATA_SRC, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const poems = [];
  let totalChars = 0;

  for (const dirName of poetDirs) {
    const author = poetNameFromDir(dirName);
    const poetDir = join(DATA_SRC, dirName);
    let files;
    try {
      files = readdirSync(poetDir).filter((f) => f.toLowerCase().endsWith(".pt")).sort();
    } catch {
      continue;
    }
    for (const file of files) {
      const raw = readFileSync(join(poetDir, file), "utf-8");
      const filenameBase = basename(file, ".pt");
      const { title, year, content } = parsePt(raw, filenameBase);
      if (!content) continue;
      poems.push({
        id: makeId(poems.length),
        title: title || "无题",
        author,
        dynasty: DYNASTY,
        form: FORM,
        ...(year ? { year } : {}),
        content,
      });
      totalChars += content.length;
    }
  }

  if (poems.length === 0) throw new Error("未解析到任何现代诗，请检查源数据");

  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(POEMS_DIR, { recursive: true });
  mkdirSync(INDEX_DIR, { recursive: true });

  writeFileSync(join(POEMS_DIR, `${SET_KEY}.json`), JSON.stringify(poems), "utf-8");

  const searchIndex = poems.map((p) => ({
    id: p.id,
    title: p.title,
    author: p.author,
    dynasty: p.dynasty,
    form: p.form,
    ...(p.year ? { year: p.year } : {}),
    content: p.content,
  }));
  writeFileSync(join(INDEX_DIR, "search.json"), JSON.stringify(searchIndex), "utf-8");

  const dynasties = [...new Set(poems.map((p) => p.dynasty).filter(Boolean))].sort();
  const forms = [...new Set(poems.map((p) => p.form).filter(Boolean))].sort();
  const meta = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalPoems: poems.length,
    totalChars,
    allDynasties: dynasties,
    allForms: forms,
    collections: [{ key: SET_KEY, label: SET_LABEL, count: poems.length, dynasties, forms }],
  };
  writeFileSync(join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

  console.log("===== 完成 =====");
  console.log(`诗人:      ${poetDirs.length.toLocaleString()} 位`);
  console.log(`总首数:    ${poems.length.toLocaleString()}`);
  console.log(`正文字数:  ${totalChars.toLocaleString()}`);
  console.log(`搜索索引:  ~${Math.round(JSON.stringify(searchIndex).length / 1024)} KB`);
  console.log(`产出:      ${DATA_DIR}/`);
}

main().catch((err) => {
  console.error("\n构建失败:", err.message ?? err);
  process.exit(1);
});
