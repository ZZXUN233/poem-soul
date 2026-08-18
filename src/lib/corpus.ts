/**
 * corpus.ts —— 服务端语料加载与缓存
 *
 * Next.js 的 public/ 目录在运行时以文件系统存在（server 端可用 fs 读取）。
 * 这里用模块级缓存缓存各集数据与 meta，避免每个请求都读盘。
 * 仅用于 Server Components 与 Route Handlers（Node 运行时）。
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CollectionMeta, CorpusMeta, Poem } from "@/types";

const DATA_DIR = join(process.cwd(), "public", "data");
const POEMS_DIR = join(DATA_DIR, "poems");
const INDEX_PATH = join(DATA_DIR, "index", "search.json");
const META_PATH = join(DATA_DIR, "meta.json");

// 模块级缓存
let metaCache: CorpusMeta | null = null;
const poemsCache = new Map<string, Poem[]>();
let searchIndexCache: Poem[] | null = null;

/** 读取并缓存 meta.json */
export async function getMeta(): Promise<CorpusMeta> {
  if (metaCache) return metaCache;
  const text = await readFile(META_PATH, "utf-8");
  metaCache = JSON.parse(text) as CorpusMeta;
  return metaCache;
}

/** 读取单个集（完整 Poem 记录，含 content），带缓存 */
export async function getCollection(key: string): Promise<Poem[]> {
  const cached = poemsCache.get(key);
  if (cached) return cached;
  const text = await readFile(join(POEMS_DIR, `${key}.json`), "utf-8");
  const poems = JSON.parse(text) as Poem[];
  poemsCache.set(key, poems);
  return poems;
}

/** 读取全集搜索索引（惰性 + 缓存），返回 Poem[] */
export async function getSearchIndex(): Promise<Poem[]> {
  if (searchIndexCache) return searchIndexCache;
  const text = await readFile(INDEX_PATH, "utf-8");
  const records = JSON.parse(text) as Poem[];
  searchIndexCache = records;
  return records;
}

/** 按 id 精确查找一首诗（id 形如 "tang-000001"）；找不到返回 null */
export async function getPoemById(id: string): Promise<Poem | null> {
  if (!id || !id.includes("-")) return null;
  const [key, raw] = id.split("-");
  const index = Number(raw) - 1;
  if (!Number.isInteger(index) || index < 0) return null;
  try {
    const poems = await getCollection(key);
    return poems[index] ?? null;
  } catch {
    return null;
  }
}

/** 读精选种子（书架初始 10 首，key 为 "poems"） */
export async function getSeeds(): Promise<Poem[]> {
  return getCollection("poems");
}

/** 列出收藏集元数据（不含种子，种子单独列） */
export function getCollectionList(meta: CorpusMeta): CollectionMeta[] {
  return meta.collections.filter((c) => c.key !== "poems");
}
