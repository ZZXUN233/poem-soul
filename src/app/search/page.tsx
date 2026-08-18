import { getMeta } from "@/lib/corpus";
import SearchPage from "@/components/SearchPage";

export const dynamic = "force-dynamic";

/** 搜索页（服务端壳：加载朝代/体裁枚举，渲染客户端搜索） */
export default async function SearchPageWrapper() {
  const meta = await getMeta();
  return <SearchPage dynasties={meta.allDynasties} forms={meta.allForms} />;
}
