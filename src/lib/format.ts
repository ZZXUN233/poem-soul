/**
 * format.ts —— 诗词正文排版辅助（纯函数）
 *
 * 语料 content 无换行、一句到底（全角标点）。这里是阅读页 / 每日一首的排版源：
 * 对近体诗短体（五绝/七绝/五律/七律）按句切分并按「对仗」分组对齐展示，
 * 其余体裁返回 null（由调用方走原有 pre-line 单行排布）。
 */

/** 采用对仗分组的近体诗短体 */
const REGULATED_FORMS = new Set([
  "五言绝句",
  "七言绝句",
  "五言律诗",
  "七言律诗",
]);

/** 句末/停顿标点：遇到即切句（标点保留在句尾） */
const LINE_END = /[，。！？；]/;

/** 一句（去掉句末标点后的正文字 + 句末标点） */
export interface LinePart {
  /** 句子的正文字（不含句末标点） */
  chars: string;
  /** 句末标点（。！？；或空） */
  punct: string;
}

/** 一个对仗组（2 句并排；末组可能仅 1 句） */
export type Couplet = LinePart[];

/** 句末/停顿标点字符 */
const LINE_END_CHARS = new Set(["，", "。", "！", "？", "；"]);

/** 切分句末标点 */
function splitPunct(token: string): LinePart {
  const last = token[token.length - 1];
  if (LINE_END_CHARS.has(last)) {
    return { chars: token.slice(0, -1), punct: last };
  }
  return { chars: token, punct: "" };
}

/** 判断是否适用对仗展示（近体诗短体且有正文） */
export function transformable(content: string, form: string): boolean {
  return REGULATED_FORMS.has(form) && content.length > 0;
}

/**
 * 切 content 为对仗组。
 * - 近体诗短体：按句末标点切句，每 2 句归一组（对仗），返回 Couplet[]。
 * - 其它体裁 / 空正文：返回 null。
 */
export function poemLines(
  content: string,
  form: string
): Couplet[] | null {
  if (!transformable(content, form)) return null;

  const parts: LinePart[] = [];
  let cur = "";
  for (const ch of content) {
    cur += ch;
    if (LINE_END.test(ch)) {
      parts.push(splitPunct(cur));
      cur = "";
    }
  }
  if (cur) parts.push(splitPunct(cur));

  // 每 2 句并成一组对仗
  const couplets: Couplet[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const pair: LinePart[] = [parts[i]];
    if (i + 1 < parts.length) pair.push(parts[i + 1]);
    couplets.push(pair);
  }
  return couplets;
}
