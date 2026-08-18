/**
 * mode.ts —— 古诗词/现代诗 模式工具（纯函数，服务端/客户端通用）
 *
 * mode 为 "classic" | "modern"，通过 URL 的 ?mode= 驱动（可分享），
 * localStorage 记住用户默认，首访无 ?mode= 时以存储值为兜底。
 */

export type Mode = "classic" | "modern";

export const DEFAULT_MODE: Mode = "classic";

const STORAGE_KEY = "peomsoul-mode";

/** 校验是否合法模式 */
export function isMode(v: unknown): v is Mode {
  return v === "classic" || v === "modern";
}

/**
 * 归一化任意 URL 里的 mode 参数。
 * 无 mode 时：客户端环境读 localStorage（可能为 null），否则 classic。
 */
export function resolveMode(raw: string | null | undefined): Mode {
  if (isMode(raw)) return raw;
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isMode(stored)) return stored;
  }
  return DEFAULT_MODE;
}

/** 记住用户默认模式（仅客户端） */
export function storeMode(mode: Mode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}

/**
 * 给路径追加 ?mode=（处理已带查询串的拼接）。
 * 若查询串里已存在 mode=，则替换它而不是追加（避免重复参数）。
 * 例：modeHref("/poem/tang-000001", "modern") → "/poem/tang-000001?mode=modern"
 *     modeHref("/search?q=月", "modern")        → "/search?q=月&mode=modern"
 *     modeHref("/search?q=月&mode=classic", "modern") → "/search?q=月&mode=modern"
 *     modeHref("/", "modern")                   → "/?mode=modern"
 */
export function modeHref(path: string, mode: Mode): string {
  const qIndex = path.indexOf("?");
  if (qIndex === -1) {
    return `${path}?mode=${mode}`;
  }
  const base = path.slice(0, qIndex);
  const params = new URLSearchParams(path.slice(qIndex + 1));
  params.set("mode", mode);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** 以某模式浏览的内链 href（当前模式为默认时才不加后缀，保持 URL 干净） */
export function poemHref(id: string, mode: Mode): string {
  return mode === DEFAULT_MODE ? `/poem/${id}` : `/poem/${id}?mode=${mode}`;
}

/** 作者作品页内链 href（作者名可能含特殊字符，需编码路径段） */
export function authorHref(author: string, mode: Mode): string {
  const path = `/author/${encodeURIComponent(author)}`;
  return mode === DEFAULT_MODE ? path : `${path}?mode=${mode}`;
}
