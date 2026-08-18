import { NextRequest } from "next/server";
import { getSearchIndex } from "@/lib/corpus";
import { buildSearchResponse, normalizeKeyword, searchPoems } from "@/lib/search";
import { isMode, type Mode } from "@/lib/mode";
import type { SearchGroup, SearchQuery } from "@/types";

export const runtime = "nodejs";
// 数据只读且一次性加载，无需 ISR/重验证
export const dynamic = "force-dynamic";

const MODES: Mode[] = ["classic", "modern"];
const LABELS: Record<Mode, string> = { classic: "古诗词", modern: "现代诗" };

/**
 * GET /api/search?q=关键词&mode=classic|modern&dynasty=&form=&match=&page=&pageSize=
 * 根据 mode 参数检索对应语料库，默认同时检索两个库。
 * dynasty/form 仅作用于古诗词组（现代诗无朝代/体裁概念）；match 作用于两组。
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = normalizeKeyword(sp.get("q") ?? "");

  const rawMode = sp.get("mode");
  const modes: Mode[] = isMode(rawMode) ? [rawMode] : MODES;

  if (!q) {
    return Response.json(
      {
        q: "",
        groups: modes.map((m) => ({
          mode: m,
          label: LABELS[m],
          total: 0,
          page: 1,
          totalPages: 0,
          hits: [],
        })),
      },
      { status: 200 }
    );
  }

  const dynasty = sp.get("dynasty") || undefined;
  const form = sp.get("form") || undefined;
  const matchRaw = sp.get("match") || undefined;
  const match =
    matchRaw === "title" || matchRaw === "author" || matchRaw === "content"
      ? matchRaw
      : undefined;
  const page = Number(sp.get("page") ?? 1);
  const pageSize = Number(sp.get("pageSize") ?? 20);

  try {
    const groups: SearchGroup[] = [];
    for (const md of modes) {
      const poems = await getSearchIndex(md);
      // 朝代/体裁过滤仅对古诗词有意义，现代诗忽略
      const dyn = md === "classic" ? dynasty : undefined;
      const f = md === "classic" ? form : undefined;
      const query: SearchQuery = { q, dynasty: dyn, form: f, match, page, pageSize };
      const hits = searchPoems(poems, q, { dynasty: dyn, form: f, match });
      const res = buildSearchResponse(hits, query);
      groups.push({
        mode: md,
        label: LABELS[md],
        total: res.total,
        page: res.page,
        totalPages: res.totalPages,
        hits: res.hits,
      });
    }
    return Response.json({ q, groups });
  } catch (err) {
    console.error("[search] 检索失败:", err);
    return Response.json(
      { error: "internal_error", message: "检索失败" },
      { status: 500 }
    );
  }
}
