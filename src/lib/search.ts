/**
 * search.ts —— 诗魂搜索核心逻辑（纯函数，供 /api/search 与测试复用）
 *
 * 数据规模：76k 首，约 540 万字 content。
 * 方案：服务端内存加载 search index 后做线性子串扫描 + 打分排序。
 *   标题/作者/正文均做包含匹配；命中优先级：标题 > 作者 > 正文。
 * 不引入中文分词/倒排依赖，保持离线、简单、可控。
 */

import type { MatchKind, Poem, SearchHit, SearchQuery, SearchResponse } from "@/types";

/**
 * 在文本中查找关键词所有出现的位置（不重叠，索引最大匹配窗口 3 字）。
 * 返回升序位置数组。
 */
function findAllPositions(text: string, keyword: string): number[] {
  if (!keyword) return [];
  const positions: number[] = [];
  let from = 0;
  // 搜索次数上限，避免超长 content + 高频词组合失控
  const maxHits = 200;
  while (from < text.length && positions.length < maxHits) {
    const idx = text.indexOf(keyword, from);
    if (idx === -1) break;
    positions.push(idx);
    from = idx + keyword.length;
  }
  return positions;
}

/** HTML 转义 + 用 <mark> 包裹命中关键词（防止 XSS，只允许 mark 标签） */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 在原文中把关键词出现位置用 <mark> 包裹（先转义再插标记） */
export function markKeyword(text: string, keyword: string): string {
  const escText = escapeHtml(text);
  const escKw = escapeHtml(keyword);
  // 用原 text 定位关键词，在转义文本上按…需要在转义后的串上工作。
  // 简化：若关键词在原文出现，直接在转义串上做替换（关键词本身通常不含需转义字符，但保险起见按原文定位）。
  if (!keyword || !text.includes(keyword)) return escText;
  const parts: string[] = [];
  let from = 0;
  while (from <= text.length) {
    const idx = text.indexOf(keyword, from);
    if (idx === -1) {
      parts.push(escapeHtml(text.slice(from)));
      break;
    }
    parts.push(escapeHtml(text.slice(from, idx)));
    parts.push(`<mark>${escapeHtml(keyword)}</mark>`);
    from = idx + keyword.length;
  }
  return parts.join("");
}

/** 从正文中截取关键词上下文片段（命中词前 after/before 各若干字符） */
export function makeSnippet(
  content: string,
  positions: number[],
  keyword: string,
  radius = 12
): string {
  if (positions.length === 0 || !keyword) return "";
  const first = positions[0];
  const start = Math.max(0, first - radius);
  const end = Math.min(content.length, first + keyword.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < content.length ? "…" : "";
  const slice = content.slice(start, end);
  return prefix + markKeyword(slice, keyword) + suffix;
}

/** 单首打分：命中类型权重 + 匹配次数，返回更高更好 */
function scorePoem(poem: Poem, kw: string): number {
  let score = 0;
  let kind: SearchHit["matchKind"] | null = null;
  if (poem.title.includes(kw)) {
    score += 1000 + findAllPositions(poem.title, kw).length;
    kind = "title";
  } else if (poem.author.includes(kw)) {
    score += 500 + findAllPositions(poem.author, kw).length;
    kind = "author";
  } else if (poem.content.includes(kw)) {
    score += findAllPositions(poem.content, kw).length;
    kind = "content";
  }
  return score * (kind ? 1 : 0) + (kind ? 0 : -Infinity);
}

/**
 * 核心搜索。给定关键词与过滤条件，返回按相关度排序后的完整命中列表（未分页）。
 * 这是一个"研究性"函数，基于传入的 poems 数组（由调用方提供，便于注入/测试）。
 * filters.match 可指定仅返回命中该字段（title/author/content）的结果。
 */
export function searchPoems(
  poems: Poem[],
  kw: string,
  filters: { dynasty?: string; form?: string; match?: MatchKind } = {}
): SearchHit[] {
  const results: SearchHit[] = [];

  for (const poem of poems) {
    // 过滤
    if (filters.dynasty && poem.dynasty !== filters.dynasty) continue;
    if (filters.form && poem.form !== filters.form) continue;

    // 匹配判定：记录命中的字段集合
    const titlePos = poem.title.includes(kw) ? findAllPositions(poem.title, kw) : [];
    const authorPos = poem.author.includes(kw) ? findAllPositions(poem.author, kw) : [];
    const contentPos = poem.content.includes(kw) ? findAllPositions(poem.content, kw) : [];
    if (titlePos.length === 0 && authorPos.length === 0 && contentPos.length === 0) continue;

    const fields: MatchKind[] = [];
    if (titlePos.length) fields.push("title");
    if (authorPos.length) fields.push("author");
    if (contentPos.length) fields.push("content");

    // 命中字段过滤（tab）
    if (filters.match && !fields.includes(filters.match)) continue;

    // 最高优先命中字段：标题 > 作者 > 正文
    let matchKind: MatchKind;
    let score = 0;
    if (titlePos.length) {
      matchKind = "title";
      score = 1000 + titlePos.length;
    } else if (authorPos.length) {
      matchKind = "author";
      score = 500 + authorPos.length;
    } else {
      matchKind = "content";
      score = contentPos.length;
    }

    const hit: SearchHit = { poem, fields, matchKind, score };
    if (titlePos.length) hit.titleMarked = markKeyword(poem.title, kw);
    if (authorPos.length) hit.authorMarked = markKeyword(poem.author, kw);
    if (contentPos.length) {
      hit.snippet = makeSnippet(poem.content, contentPos, kw);
    }
    results.push(hit);
  }

  // 排序：总分降序，次按 id 稳定序
  results.sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
    return a.poem.id.localeCompare(b.poem.id);
  });

  return results;
}

/** 分页裁剪 + 组装最终响应 */
export function buildSearchResponse(
  hits: SearchHit[],
  query: SearchQuery
): SearchResponse {
  const page = query.page && query.page >= 1 ? Math.floor(query.page) : 1;
  const pageSize =
    query.pageSize && query.pageSize >= 1 && query.pageSize <= 100
      ? Math.floor(query.pageSize)
      : 20;
  const total = hits.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const paged = hits.slice(start, start + pageSize);

  // 剥离内部 score 字段
  const cleanHits = paged.map(({ score, ...rest }) => rest);

  return { q: query.q, total, page, pageSize, totalPages, hits: cleanHits };
}

/** 关键词规范化：去首尾空白、压缩中间连续空白 */
export function normalizeKeyword(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, "");
}

/** 字符串确定性哈希（0 ~ 2^32-1），用于按 seed 随机排序 */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** mulberry32：确定性伪随机数生成器 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 按 seed 确定性洗牌（Fisher-Yates），同一 seed 得到相同顺序便于稳定分页 */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed));
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 浏览/书架：在给定诗词数组上做 朝代/体裁/集 过滤 + 排序 + 分页（无需关键字）。
 * sort:"random" 时按 seed 确定性洗牌（缺省 seed 用固定串），同一 seed 分页稳定。
 * 返回 { items, total, page, totalPages }。纯函数，便于测试。
 */
export function browsePoems(
  poems: Poem[],
  opts: {
    dynasty?: string;
    form?: string;
    collection?: string;
    sort?: "random";
    seed?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  let filtered = poems.filter((p) => {
    if (opts.collection && !p.id.startsWith(`${opts.collection}-`)) return false;
    if (opts.dynasty && p.dynasty !== opts.dynasty) return false;
    if (opts.form && p.form !== opts.form) return false;
    return true;
  });

  // 随机排序：确定性洗牌，保持分页稳定
  if (opts.sort === "random") {
    filtered = seededShuffle(filtered, opts.seed ?? "poem-soul-browse");
  }

  const page = opts.page && opts.page >= 1 ? Math.floor(opts.page) : 1;
  const pageSize =
    opts.pageSize && opts.pageSize >= 1 && opts.pageSize <= 100
      ? Math.floor(opts.pageSize)
      : 20;
  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return { items, total, page, pageSize, totalPages };
}
