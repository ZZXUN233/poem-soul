/**
 * 诗词数据模型 —— 与 Android 侧 PoemSeed 对应的 TS 类型。
 * 语料经 scripts/build-data.mjs 从 assets/corpus 的 gz 解压后获得，
 * content 已清洗：无空白、全角标点一句到底。
 */

/** 一首诗的完整记录（与 Android PoemSeed 5 字段对齐 + Web 侧 id） */
export interface Poem {
  /** 稳定 id，如 "tang-000001"，供 /poem/[id] 路由与搜索结果引用 */
  id: string;
  /** 标题 / 词牌名 */
  title: string;
  /** 作者 */
  author: string;
  /** 朝代，如 "唐"、"宋"、"元" */
  dynasty: string;
  /** 体裁，如 "五言绝句"、"词"、"曲"、"诗经"、"楚辞"，可为 ""（未知） */
  form: string;
  /** 清洗后的正文，一句到底（无空白、全角标点） */
  content: string;
}

/** 命中的字段类型 */
export type MatchKind = "title" | "author" | "content";

/** 单个搜索结果命中（多字段高亮 + 正文片段） */
export interface SearchHit {
  poem: Poem;
  /** 标题命中时高亮后的 HTML 片段（含 <mark>） */
  titleMarked?: string;
  /** 作者命中时高亮后的 HTML 片段（含 <mark>） */
  authorMarked?: string;
  /** 正文命中时截取的关键词上下文片段（含 <mark>），未命中正文则缺省 */
  snippet?: string;
  /** 命中的字段集合（一首可同时命中标题+正文），用于「命中X」tab 过滤 */
  fields: MatchKind[];
  /** 最高优先命中字段（标题>作者>正文），用于展示角标与排序 */
  matchKind: MatchKind;
  /**
   * 内部使用：相关度得分（仅 searchPoems 内部赋值，构造响应时剥离）。
   * 不作为 API 契约字段。
   */
  score?: number;
}

/** 搜索请求参数 */
export interface SearchQuery {
  /** 检索关键词（已 trim） */
  q: string;
  /** 精确朝代过滤（可选） */
  dynasty?: string;
  /** 精确体裁过滤（可选） */
  form?: string;
  /** 仅返回命中该字段的结果（title/author/content），缺省=全部 */
  match?: MatchKind;
  /** 页码，从 1 开始 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
}

/** 搜索 API 响应 */
export interface SearchResponse {
  q: string;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hits: SearchHit[];
}

/** 单个诗集的元数据（由 build-data.mjs 写入 meta.json） */
export interface CollectionMeta {
  /** 集 key，如 "tang"、"song_ci" */
  key: string;
  /** 展示名，如 "全唐诗" */
  label: string;
  /** 记录数 */
  count: number;
  /** 所含朝代（去重） */
  dynasties: string[];
  /** 所含体裁（去重） */
  forms: string[];
}

/** data 总概览（meta.json） */
export interface CorpusMeta {
  /** schema 版本 */
  version: number;
  /** 生成时间 */
  generatedAt: string;
  /** 诗词总首数 */
  totalPoems: number;
  /** 正文字符总数 */
  totalChars: number;
  /** 全部出现的朝代（全局去重） */
  allDynasties: string[];
  /** 全部出现的体裁（全局去重） */
  allForms: string[];
  /** 各集元数据 */
  collections: CollectionMeta[];
}
