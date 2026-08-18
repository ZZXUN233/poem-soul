import { NextRequest } from "next/server";
import { getPoemBySeed } from "@/lib/corpus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/random?seed=xxx
 * 从全库确定性选取一首诗。seed 缺省用「今日日期」→ 每日一首稳定；
 * 传入随机 seed 则可重摇换诗。
 */
export async function GET(request: NextRequest) {
  const seed =
    request.nextUrl.searchParams.get("seed") ??
    new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const poem = await getPoemBySeed(seed);
    return Response.json(poem);
  } catch (err) {
    console.error("[random] 选诗失败:", err);
    return Response.json(
      { error: "internal_error", message: "选诗失败" },
      { status: 500 }
    );
  }
}
