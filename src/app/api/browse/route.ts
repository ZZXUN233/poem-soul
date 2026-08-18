import { NextRequest } from "next/server";
import { getSearchIndex } from "@/lib/corpus";
import { browsePoems } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/browse?collection=&dynasty=&form=&page=&pageSize=
 * 书架/浏览：无关键字，按 集/朝代/体裁 过滤 + 分页。
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const collection = sp.get("collection") || undefined;
  const dynasty = sp.get("dynasty") || undefined;
  const form = sp.get("form") || undefined;
  const page = Number(sp.get("page") ?? 1);
  const pageSize = Number(sp.get("pageSize") ?? 20);

  try {
    const poems = await getSearchIndex();
    const result = browsePoems(poems, {
      collection,
      dynasty,
      form,
      page,
      pageSize,
    });
    return Response.json(result);
  } catch (err) {
    console.error("[browse] 加载失败:", err);
    return Response.json(
      { error: "internal_error", message: "加载失败" },
      { status: 500 }
    );
  }
}
