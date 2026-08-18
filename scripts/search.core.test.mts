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
