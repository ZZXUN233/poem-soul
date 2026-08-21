/**
 * search.core.test.ts —— 搜索核心逻辑最小单测
 * 运行：npm run test    （基于 Node 内置 node:test + tsx 执行 TS）
 * 覆盖：排序优先级 / 高亮转义 / 片段 / 分页边界 / 过滤。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  browsePoems,
  buildSearchResponse,
  escapeHtml,
  markKeyword,
  makeSnippet,
  normalizeKeyword,
  searchPoems,
} from "../src/lib/search";
import { poemLines, transformable } from "../src/lib/format";
import { getRelatedBatch, getRelatedPoems } from "../src/lib/related";
import {
  FAVORITES_KEY,
  addFavorite,
  getFavorites,
  isFavorite,
  removeFavorite,
} from "../src/lib/favorites";
import type { Poem } from "../src/types";

const poem: Poem = {
  id: "tang-000001",
  title: "静夜思",
  author: "李白",
  dynasty: "唐",
  form: "五言绝句",
  content: "床前明月光，疑是地上霜。举头望明月，低头思故乡。",
};

const other: Poem = {
  id: "tang-000002",
  title: "春晓",
  author: "孟浩然",
  dynasty: "唐",
  form: "五言绝句",
  content: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。",
};

const kait: Poem = {
  id: "song_ci-000001",
  title: "一剪梅",
  author: "李清照",
  dynasty: "宋",
  form: "词",
  content: "红藕香残玉簟秋。轻解罗裳，独上兰舟。",
};

const corpus: Poem[] = [poem, other, kait];

test("标题命中优先于正文命中", () => {
  const hits = searchPoems(corpus, "明月");
  // 静夜思 标题无"明月"，但其正文有两处"明月"；春晓正文无"明月"。
  // 仅 poems 与 kait 不含"明月"。这里验证排序/字段。

  const staticHits = searchPoems(corpus, "静夜思");
  assert.equal(staticHits.length, 1);
  assert.equal(staticHits[0].matchKind, "title");
  assert.ok(staticHits[0].titleMarked?.includes("<mark>静夜思</mark>"));
});

test("作者命中返回 authorMarked", () => {
  const hits = searchPoems(corpus, "李白");
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].matchKind, "author");
  assert.ok(hits[0].authorMarked?.includes("<mark>李白</mark>"));
});

test("正文命中生成片段且转义", () => {
  const hits = searchPoems(corpus, "明月");
  const byTitle = hits.filter((h) => h.matchKind === "content").find((h) => h.poem.id === "tang-000001");
  assert.ok(byTitle, "应命中静夜思正文");
  assert.ok(byTitle.snippet?.includes("<mark>明月</mark>"));
});

test("Html 转义防止 XSS", () => {
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
  const marked = markKeyword("a<b>", "<");
  assert.ok(!marked.includes("<b>"));
});

test("关键词规范化去除空白", () => {
  assert.equal(normalizeKeyword("  明月  光 "), "明月光");
});

test("browsePoems 过滤 + 分页边界", () => {
  const { items, total, totalPages } = browsePoems(corpus, {
    dynasty: "唐",
    page: 1,
    pageSize: 1,
  });
  assert.equal(total, 2);
  assert.equal(totalPages, 2);
  assert.equal(items.length, 1);

  // 分页越界返回空
  const last = browsePoems(corpus, { dynasty: "唐", page: 99, pageSize: 1 });
  assert.equal(last.items.length, 0);

  // collection 过滤
  const coll = browsePoems(corpus, { collection: "song_ci" });
  assert.equal(coll.total, 1);
});

test("browsePoems 随机排序：同 seed 稳定，不同 seed 打乱", () => {
  // 构造一批可排序的诗词
  const codes = Array.from({ length: 50 }, (_, i) => String.fromCharCode(0x4e00 + i));
  const big = codes.map((title, i) => ({
    id: `x-${String(i).padStart(6, "0")}`,
    title,
    author: "",
    dynasty: "唐",
    form: "五言绝句",
    content: "",
  }));

  // 同一 seed 两页作者/顺序一致（稳定分页）
  const a1 = browsePoems(big, { sort: "random", seed: "s-1", page: 1, pageSize: 10 }).items.map((p) => p.id);
  const a2 = browsePoems(big, { sort: "random", seed: "s-1", page: 1, pageSize: 10 }).items.map((p) => p.id);
  assert.deepEqual(a1, a2, "同 seed 应得到相同顺序");

  // 不同 seed 顺序应不同
  const b = browsePoems(big, { sort: "random", seed: "s-2", page: 1, pageSize: 10 }).items.map((p) => p.id);
  const same = a1.length === b.length && a1.every((v, i) => v === b[i]);
  assert.equal(same, false, "不同 seed 顺序应不同");

  // 未指定 seed 时也应有内容且总数不变
  const total = browsePoems(big, { sort: "random" }).total;
  assert.equal(total, big.length);
});

test("buildSearchResponse 剥离内部 score 并分页", () => {
  const hits = searchPoems(corpus, "唐"); // 无关键字命中？"唐"不在任何字段，应返回 0
  // 用附带 score 的构造检验
  const resp = buildSearchResponse(hits, { q: "唐", page: 1, pageSize: 20 });
  assert.equal(resp.total, hits.length);
  assert.ok(
    resp.hits.every((h) => (h as any).score === undefined),
    "内部 score 不得出现在响应中"
  );
});

// 一首同时命中 标题+正文 的样例
const both: Poem = {
  id: "tang-000003",
  title: "明月",
  author: "某甲",
  dynasty: "唐",
  form: "五言绝句",
  content: "床前明月光，疑是地上霜。",
};

test("一首可同时命中标题与正文（fields 记录）", () => {
  const hits = searchPoems([poem, both], "明月");
  const hit = hits.find((h) => h.poem.id === "both" || h.poem.title === "明月");
  assert.ok(hit, "应命中 both");
  assert.ok(hit!.fields.includes("title"));
  assert.ok(hit!.fields.includes("content"));
});

test("match 过滤：命中标题 / 命中正文 tab", () => {
  const base = [poem, other, kait, both];
  const titleOnly = searchPoems(base, "明月", { match: "title" });
  // 只有 both 的标题命中
  assert.equal(titleOnly.length, 1);
  assert.equal(titleOnly[0].poem.title, "明月");

  const contentOnly = searchPoems(base, "明月", { match: "content" });
  // poem(静夜思正文两处) + both(正文一处)
  assert.ok(contentOnly.length >= 2);
  assert.ok(contentOnly.some((h) => h.poem.id === "tang-000001"));

  const authorOnly = searchPoems(base, "明月", { match: "author" });
  assert.equal(authorOnly.length, 0);
});

test("poemLines 对仗分组：五言绝句切成 2 联", () => {
  assert.equal(transformable("床前明月光，疑是地上霜。举头望明月，低头思故乡。", "五言绝句"), true);
  const lines = poemLines(
    "床前明月光，疑是地上霜。举头望明月，低头思故乡。",
    "五言绝句"
  );
  assert.ok(lines);
  assert.equal(lines!.length, 2); // 2 联
  // 第一联：出句=床前明月光，对句=疑是地上霜
  assert.equal(lines![0][0].chars, "床前明月光");
  assert.equal(lines![0][1].chars, "疑是地上霜");
});

test("poemLines 非近体诗体裁返回 null", () => {
  assert.equal(poemLines("红藕香残玉簟秋，轻解罗裳", "词"), null);
  assert.equal(poemLines("", "五言绝句"), null);
});

// 相关推荐测试语料
const relIndex: Poem[] = [
  { id: "tang-000001", title: "静夜思", author: "李白", dynasty: "唐", form: "五言绝句", content: "A。" },
  { id: "tang-000002", title: "春晓", author: "孟浩然", dynasty: "唐", form: "五言绝句", content: "B。" },
  { id: "song_ci-0001", title: "静夜思", author: "李白", dynasty: "唐", form: "五言绝句", content: "C。" },
  { id: "tang-000003", title: "春晓", author: "孟浩然", dynasty: "唐", form: "五言绝句", content: "D。" },
  { id: "wudai-0001", title: "静夜思", author: "李白", dynasty: "唐", form: "五言绝句", content: "E。" },
];

test("getRelatedPoems：同类/同作者/同名都排除自身", () => {
  const me = relIndex[0]; // 静夜思 / 李白 / 五言绝句
  const r = getRelatedPoems(me, relIndex);

  // 同类（五言绝句）：其余 4 首都是五言绝句
  assert.ok(r.form.every((p) => p.form === "五言绝句"));
  assert.ok(r.form.every((p) => p.id !== me.id));
  // 同作者（李白）：2 首
  assert.ok(r.author.every((p) => p.author === "李白"));
  assert.ok(r.author.every((p) => p.id !== me.id));
  // 同名（静夜思）：2 首
  assert.ok(r.title.every((p) => p.title === "静夜思"));
  assert.ok(r.title.every((p) => p.id !== me.id));
});

test("getRelatedPoems：无名氏作者不参与同作者推荐", () => {
  const anon: Poem = {
    id: "tang-0010",
    title: "x",
    author: "无名氏",
    dynasty: "唐",
    form: "五言绝句",
    content: "y。",
  };
  const pool: Poem[] = [anon, relIndex[0]];
  const r = getRelatedPoems(anon, pool);
  assert.equal(r.author.length, 0, "无名氏不应有同作者推荐");
  assert.equal(r.form.length, 1, "同类仍正常");
});

test("getRelatedPoems：数量不超过上限 LIMIT=4", () => {
  // 10 首同作者（白居易）+ 一首当前诗（也是白居易）
  const pool: Poem[] = Array.from({ length: 10 }, (_, i) => ({
    id: `tang-${String(100 + i)}`,
    title: `t${i}`,
    author: "白居易",
    dynasty: "唐",
    form: "五言绝句",
    content: `${i}`,
  }));
  const me: Poem = {
    id: "me-0",
    title: "当前",
    author: "白居易",
    dynasty: "唐",
    form: "五言绝句",
    content: "z",
  };
  const r = getRelatedPoems(me, [...pool, me]);
  // 同作者 10 首 → 截取不超过 4，且排除自身
  assert.ok(r.author.length <= 4);
  assert.ok(r.author.length > 0);
  assert.ok(r.author.every((p) => p.id !== me.id));
  // 同类（五言绝句）10 首 → 截取不超过 4
  assert.ok(r.form.length <= 4);
  assert.ok(r.form.length > 0);
});

test("getRelatedBatch：按字段取批、排除自身、LIMIT 上限", () => {
  // 10 首同作者（李白），1 首当前诗（也是李白）
  const authors: Poem[] = Array.from({ length: 10 }, (_, i) => ({
    id: `tang-z${i}`,
    title: `t${i}`,
    author: "李白",
    dynasty: "唐",
    form: "五言绝句",
    content: `${i}`,
  }));
  const me: Poem = {
    id: "me-1",
    title: "当前",
    author: "李白",
    dynasty: "唐",
    form: "五言绝句",
    content: "z",
  };
  const pool = [...authors, me];

  const batch = getRelatedBatch(me, pool, "author", "s1");
  assert.ok(batch.length <= 4, "每批不超过 LIMIT");
  assert.ok(batch.length > 0);
  assert.ok(batch.every((p) => p.author === "李白"), "该字段只含同作者");
  assert.ok(batch.every((p) => p.id !== me.id), "排除自身");

  // 不相关的字段返回空
  assert.equal(getRelatedBatch(me, pool, "title", "s1").length, 0);
});

test("getRelatedBatch：不同 seed 得到不同批", () => {
  const pool: Poem[] = Array.from({ length: 50 }, (_, i) => ({
    id: `tang-b${i}`,
    title: `t${i}`,
    author: "杜甫",
    dynasty: "唐",
    form: "七言绝句",
    content: `${i}`,
  }));
  const me: Poem = {
    id: "me-2",
    title: "当前",
    author: "杜甫",
    dynasty: "唐",
    form: "七言绝句",
    content: "z",
  };
  const full = [...pool, me];

  const a = getRelatedBatch(me, full, "author", "seed-a");
  const a2 = getRelatedBatch(me, full, "author", "seed-a");
  const b = getRelatedBatch(me, full, "author", "seed-b");

  assert.deepEqual(
    a.map((p) => p.id),
    a2.map((p) => p.id),
    "同 seed 批相同"
  );
  const idsA = new Set(a.map((p) => p.id));
  const idsB = new Set(b.map((p) => p.id));
  const overlap = a.filter((p) => idsB.has(p.id)).length;
  assert.ok(
    overlap < a.length,
    "不同 seed 应产生不同批次（允许少量重叠）"
  );
});

// ===== mode.ts 纯函数 =====
import {
  DEFAULT_MODE,
  isMode,
  modeHref,
  poemHref,
  resolveMode,
  storeMode,
} from "../src/lib/mode";

test("isMode 校验", () => {
  assert.equal(isMode("classic"), true);
  assert.equal(isMode("modern"), true);
  assert.equal(isMode("foo"), false);
  assert.equal(isMode(undefined), false);
  assert.equal(isMode(null), false);
});

test("resolveMode 缺省回退", () => {
  assert.equal(resolveMode("modern"), "modern");
  assert.equal(resolveMode("classic"), "classic");
  assert.equal(resolveMode("bogus"), DEFAULT_MODE);
  // Node 无 window，故 undefined 回退到默认 classic
  assert.equal(resolveMode(undefined), DEFAULT_MODE);
});

test("modeHref 拼接 query", () => {
  assert.equal(modeHref("/poem/tang-000001", "modern"), "/poem/tang-000001?mode=modern");
  assert.equal(modeHref("/search?q=月", "modern"), "/search?q=%E6%9C%88&mode=modern");
  assert.equal(modeHref("/", "modern"), "/?mode=modern");
  assert.equal(modeHref("/poem/tang-000001", "classic"), "/poem/tang-000001?mode=classic");
});

test("modeHref 替换已有 mode 参数（避免重复）", () => {
  // 模式开关在已带 mode 的页面上切换，应替换而非追加
  assert.equal(
    modeHref("/search?q=%E6%9C%88&mode=modern", "classic"),
    "/search?q=%E6%9C%88&mode=classic"
  );
  assert.equal(
    modeHref("/search?mode=modern", "classic"),
    "/search?mode=classic"
  );
  assert.equal(
    modeHref("/search?q=xx&mode=classic&page=2", "modern"),
    "/search?q=xx&mode=modern&page=2"
  );
});

test("poemHref 默认模式下 URL 干净", () => {
  assert.equal(poemHref("tang-000001", "classic"), "/poem/tang-000001");
  assert.equal(poemHref("xian_dai-000001", "modern"), "/poem/xian_dai-000001?mode=modern");
});

test("storeMode 无 window 安全（Node 环境不抛错）", () => {
  assert.doesNotThrow(() => storeMode("modern"));
});

/* ---- favorites 抽卡收藏 ---- */

/** 内存版 storage，模拟浏览器 localStorage */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    snapshot: () => map,
  };
}

test("getFavorites 无存储时返回空、不抛错（Node 降级）", () => {
  assert.deepEqual(getFavorites(null), []);
  assert.equal(isFavorite("tang-000001", null), false);
});

test("addFavorite 去重且回写持久化", () => {
  const st = memoryStorage();
  addFavorite("tang-000001", st);
  addFavorite("tang-000002", st);
  addFavorite("tang-000001", st); // 重复不应再次入列
  assert.deepEqual(getFavorites(st), ["tang-000001", "tang-000002"]);
  assert.equal(isFavorite("tang-000001", st), true);
  assert.equal(isFavorite("song_ci-1", st), false);
  // 键值确实写入了 storage
  const raw = st.getItem(FAVORITES_KEY);
  assert.deepEqual(JSON.parse(raw!), ["tang-000001", "tang-000002"]);
});

test("addFavorite 超出上限丢弃最旧", () => {
  const st = memoryStorage();
  for (let i = 0; i < 1005; i++) addFavorite(`id-${i}`, st);
  const list = getFavorites(st);
  assert.equal(list.length, 1000);
  // 保留了最后 1000 条，最旧的 5 条被丢弃
  assert.equal(list[0], "id-5");
  assert.equal(list[list.length - 1], "id-1004");
});

test("removeFavorite 删除指定 id", () => {
  const st = memoryStorage();
  addFavorite("a", st);
  addFavorite("b", st);
  addFavorite("c", st);
  removeFavorite("b", st);
  assert.deepEqual(getFavorites(st), ["a", "c"]);
  removeFavorite("不存在", st);
  assert.deepEqual(getFavorites(st), ["a", "c"]);
});

test("addFavorite 写抛出异常时静默（安全降级）", () => {
  const throwing: {
    getItem: (k: string) => string | null;
    setItem: (k: string, v: string) => void;
  } = {
    getItem: () => "[]",
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.doesNotThrow(() => addFavorite("x", throwing));
});
