import { NextRequest } from "next/server";
import { getSearchIndex } from "@/lib/corpus";
import {
  buildSearchResponse,
  normalizeKeyword,
  searchPoems,
} from "@/lib/search";
import type { SearchQuery } from "@/types";

export const runtime = "nodejs";
// 数据只读且一次性加载，无需 ISR/重验证
export const dynamic = "force-dynamic";

/** GET /api/search?q=关键词&dynasty=&form=&page=&pageSize= */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = normalizeKeyword(sp.get("q") ?? "");

  if (!q) {
    return Response.json(
      { q: "", total: 0, page: 1, pageSize: 20, totalPages: 0, hits: [] },
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

  const query: SearchQuery = { q, dynasty, form, match, page, pageSize };

  try {
    const poems = await getSearchIndex();
    const hits = searchPoems(poems, q, { dynasty, form, match });
    const response = buildSearchResponse(hits, query);
    return Response.json(response);
  } catch (err) {
    console.error("[search] 检索失败:", err);
    return Response.json(
      { error: "internal_error", message: "检索失败" },
      { status: 500 }
    );
  }
}
