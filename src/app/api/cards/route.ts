import { NextRequest } from "next/server";
import { getSearchIndex } from "@/lib/corpus";
import { browsePoems } from "@/lib/search";
import { resolveMode } from "@/lib/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_COUNT = 10;
const MIN_COUNT = 3;
const MAX_COUNT = 20;

/**
 * GET /api/cards?mode=&seed=&count=
 * 抽卡模式：从当前语料库确定性随机取「一叠」N 首诗（无分页，供全屏卡片滑动）。
 * 复用 browsePoems 的 sort:"random"（seededShuffle），同一 seed 顺序稳定；
 * 客户端可换新 seed 续叠 / 换叠。
 * 返回 { poems, seed }。
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = resolveMode(sp.get("mode"));
  const seed = sp.get("seed") || crypto.randomUUID();
  const rawCount = Number(sp.get("count"));
  const count = Number.isFinite(rawCount)
    ? Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.floor(rawCount)))
    : DEFAULT_COUNT;

  try {
    const poems = await getSearchIndex(mode);
    const { items } = browsePoems(poems, {
      sort: "random",
      seed,
      page: 1,
      pageSize: count,
    });
    return Response.json({ poems: items, seed });
  } catch (err) {
    console.error("[cards] 抽卡失败:", err);
    return Response.json(
      { error: "internal_error", message: "抽卡失败" },
      { status: 500 }
    );
  }
}
