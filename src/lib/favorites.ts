/**
 * favorites.ts —— 抽卡模式本地收藏（localStorage 存 poem id）
 *
 * 纯逻辑 + 可注入 storage，便于 Node 单测：
 * 函数可选接收一个「最小 storage 接口」（getItem/setItem），缺省用浏览器
 * localStorage；Node/SSR 无 window 时安全降级（返回空/仅内存返回，不抛错）。
 * 与 search.ts 的「注入 poems 以便测试」同一思路。
 */

/** 抽卡收藏的 localStorage 键 */
export const FAVORITES_KEY = "peomsoul-cards-favorites";

/** 收藏上限，防止数组无限膨胀 */
const FAVORITES_MAX = 1000;

/** 最小存储接口，测试可注入内存版 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** 浏览器环境下取 localStorage，否则 null */
function defaultStorage(): StorageLike | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    /* 隐私模式等场景可能抛错 */
  }
  return null;
}

/** 容错读取并解析收藏 id 数组 */
function parseList(storage: StorageLike): string[] {
  try {
    const raw = storage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * 读取收藏的 poem id 数组。
 * @param storage 可选注入（测试用）；缺省用浏览器 localStorage，Node 下返回 []。
 */
export function getFavorites(storage?: StorageLike | null): string[] {
  const s = storage ?? defaultStorage();
  return s ? parseList(s) : [];
}

/** 某 id 是否已收藏 */
export function isFavorite(
  id: string,
  storage?: StorageLike | null
): boolean {
  return getFavorites(storage).includes(id);
}

/**
 * 收藏一首：去重后追加并回写，返回最新收藏数组。
 * 超出上限时丢弃最旧；写失败静默忽略。
 */
export function addFavorite(
  id: string,
  storage?: StorageLike | null
): string[] {
  const s = storage ?? defaultStorage();
  if (!s) return [id];
  const list = parseList(s);
  if (!list.includes(id)) list.push(id);
  const trimmed = list.slice(-FAVORITES_MAX);
  try {
    s.setItem(FAVORITES_KEY, JSON.stringify(trimmed));
  } catch {
    /* 写失败静默 */
  }
  return trimmed;
}

/** 取消收藏某 id，返回最新收藏数组 */
export function removeFavorite(
  id: string,
  storage?: StorageLike | null
): string[] {
  const s = storage ?? defaultStorage();
  if (!s) return getFavorites(null);
  const next = parseList(s).filter((x) => x !== id);
  try {
    s.setItem(FAVORITES_KEY, JSON.stringify(next));
  } catch {
    /* 写失败静默 */
  }
  return next;
}
