import { NextRequest } from "next/server";
import { getPoemBySeed } from "@/lib/corpus";
import { resolveMode } from "@/lib/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/random?mode=&seed=xxx
 * 从全库确定性选取一首诗。seed 缺省用「今日日期」→ 每日一首稳定；
 * 传入随机 seed 则可重摇换诗。
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = resolveMode(sp.get("mode"));
  const seed =
    sp.get("seed") ??
    Date.now().toString(36); // 每次随机

  try {
    const poem = await getPoemBySeed(mode, seed);
    return Response.json(poem);
  } catch (err) {
    console.error("[random] 选诗失败:", err);
    return Response.json(
      { error: "internal_error", message: "选诗失败" },
      { status: 500 }
    );
  }
}
