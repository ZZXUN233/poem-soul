/**
 * related.ts —— 诗词相关推荐（纯函数，服务端 RSC 内调用）
 *
 * 基于全库 search index 线性扫（76k，已缓存）为单首诗推荐：
 *   - 同类：同 form（体裁）
 *   - 同作者：同 author
 *   - 同名：同 title（词/曲的 title 即词牌/曲牌，故「同名」≈「同词牌」，仍有效）
 * 每类最多 N 首，排除自身；「无名氏」等无意义作者不参与同作者推荐。
 * 用 seededShuffle(seed=poem.id) 打乱后截取，保证即使同一作者/体裁众多也有变化且稳定。
 */

import type { Poem } from "@/types";
import { seededShuffle } from "./search";

/** 每类最多推荐数 */
const LIMIT = 4;

/** 同作者推荐中应跳过的无意义/匿名作者 */
const NOISE_AUTHORS = new Set([
  "无名氏",
  "佚名",
  "不详",
  "无名",
  "无",
  "",
]);

export interface RelatedPoems {
  /** 同类（同体裁） */
  form: Poem[];
  /** 同作者（非匿名） */
  author: Poem[];
  /** 同名（同题/同词牌） */
  title: Poem[];
}

/** 可取批的相关字段 */
export type RelatedField = "form" | "author" | "title";

/** 收集某类候选，为「换一批」复用；每类最多收集 LIMIT*2 以留足洗牌余量 */
function collectField(
  poem: Poem,
  index: Poem[],
  field: RelatedField
): Poem[] {
  const out: Poem[] = [];
  for (const p of index) {
    if (p.id === poem.id) continue; // 排除自身

    if (field === "form" && poem.form && p.form === poem.form) {
      out.push(p);
    } else if (
      field === "author" &&
      poem.author &&
      !NOISE_AUTHORS.has(poem.author) &&
      p.author === poem.author
    ) {
      out.push(p);
    } else if (field === "title" && poem.title && p.title === poem.title) {
      out.push(p);
    }

    if (out.length >= LIMIT * 2) break;
  }
  return out;
}

/** 生成一首诗的相关推荐（缺省 seed 用 poem.id，SSR 首屏批次稳定） */
export function getRelatedPoems(
  poem: Poem,
  index: Poem[],
  seed = poem.id
): RelatedPoems {
  return {
    form: getRelatedBatch(poem, index, "form", seed),
    author: getRelatedBatch(poem, index, "author", seed),
    title: getRelatedBatch(poem, index, "title", seed),
  };
}

/** 取某一类的一批（用于「换一批」：携带新 seed 获得不同批次） */
export function getRelatedBatch(
  poem: Poem,
  index: Poem[],
  field: RelatedField,
  seed: string
): Poem[] {
  const pool = collectField(poem, index, field);
  return seededShuffle(pool, `${field}-${seed}`).slice(0, LIMIT);
}

/** 判断某类是否有内容（用于节渲染与否） */
export function hasRelated(related: RelatedPoems): boolean {
  return (
    related.form.length > 0 ||
    related.author.length > 0 ||
    related.title.length > 0
  );
}
