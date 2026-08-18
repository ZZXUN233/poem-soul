import { getMeta } from "@/lib/corpus";
import SearchPage from "@/components/SearchPage";

export const dynamic = "force-dynamic";

/** 搜索页（服务端壳：加载古诗词朝代/体裁枚举，用于过滤古诗词组；跨库检索古诗词+现代诗） */
export default async function SearchPageWrapper() {
  // 朝代/体裁是古诗词概念，过滤仅作用于古诗词组 → 恒用经典枚举
  const meta = await getMeta("classic");
  return <SearchPage dynasties={meta.allDynasties} forms={meta.allForms} />;
}
