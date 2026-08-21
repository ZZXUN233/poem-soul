import { NextRequest } from "next/server";
import { getSearchIndex } from "@/lib/corpus";
import type { Poem } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/favorites?ids=tang-1,song_ci-2,xian_dai-3,...
 * 把 localStorage 里收藏的 poem id 解析回完整 Poem 列表（供「我的收藏」查看）。
 * 收藏可能跨古诗词/现代诗，故同时扫描两套语料索引来解析。
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const idsRaw = sp.get("ids");
  if (!idsRaw) return Response.json({ poems: [] });

  const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return Response.json({ poems: [] });

  try {
    const [classic, modern] = await Promise.all([
      getSearchIndex("classic"),
      getSearchIndex("modern"),
    ]);
    const byId = new Map<string, Poem>();
    for (const p of classic) byId.set(p.id, p);
    for (const p of modern) byId.set(p.id, p);
    const result: Poem[] = ids
      .map((id) => byId.get(id))
      .filter((p): p is Poem => Boolean(p));
    return Response.json({ poems: result });
  } catch (err) {
    console.error("[favorites] 读取收藏失败:", err);
    return Response.json({ poems: [] }, { status: 500 });
  }
}
