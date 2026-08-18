import { NextRequest } from "next/server";
import { getPoemById, getSearchIndex } from "@/lib/corpus";
import { getRelatedBatch, type RelatedField } from "@/lib/related";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = new Set<RelatedField>(["form", "author", "title"]);

/**
 * GET /api/related?id=<poemId>&field=<form|author|title>&seed=<random>
 * 取某一类相关推荐的一批。「换一批」= 携带新 seed 请求新一批。
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const id = sp.get("id") ?? "";
  const field = sp.get("field") as RelatedField | null;
  const seed = sp.get("seed");

  if (!field || !FIELDS.has(field) || !seed) {
    return Response.json(
      { error: "bad_request", message: "缺少 field / seed 参数" },
      { status: 400 }
    );
  }

  try {
    const poem = await getPoemById(id);
    if (!poem) {
      return Response.json({ field, items: [] });
    }
    const index = await getSearchIndex();
    const items = getRelatedBatch(poem, index, field, seed);
    return Response.json({ field, items });
  } catch (err) {
    console.error("[related] 取批失败:", err);
    return Response.json(
      { error: "internal_error", message: "推荐失败" },
      { status: 500 }
    );
  }
}
