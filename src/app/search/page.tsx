import { getMeta } from "@/lib/corpus";
import { isMode, type Mode } from "@/lib/mode";
import SearchPage from "@/components/SearchPage";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; dynasty?: string; form?: string; match?: string; mode?: string; page?: string }>;
}

/** 搜索页（服务端壳：根据 mode 参数加载对应语料库的朝代/体裁枚举） */
export default async function SearchPageWrapper({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const mode: Mode = isMode(sp.mode) ? sp.mode : "classic";
  const meta = await getMeta(mode);
  return <SearchPage mode={mode} dynasties={meta.allDynasties} forms={meta.allForms} />;
}
