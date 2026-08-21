import { notFound } from "next/navigation";
import { getPoemById, getSearchIndex } from "@/lib/corpus";
import { getRelatedPoems } from "@/lib/related";
import { isMode, type Mode } from "@/lib/mode";
import PoemReader from "@/components/PoemReader";
import ReaderBack from "@/components/ReaderBack";
import ShareActions from "@/components/ShareActions";
import RelatedSection from "@/components/RelatedSection";

export const dynamic = "force-dynamic";

interface ReaderPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}

/** 阅读页：按稳定 id（如 tang-000001 / xian_dai-000001）展示单首诗词 + 分享 + 相关推荐 */
export default async function ReaderPage({
  params,
  searchParams,
}: ReaderPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const mode: Mode = isMode(sp.mode) ? sp.mode : "classic";
  const poem = await getPoemById(mode, id);
  if (!poem) {
    notFound();
  }
  const skin = mode === "modern" ? "page-modern" : "page-classic";

  // 相关推荐：同类/同作者/同名（全库线性扫，search index 已缓存）
  const index = await getSearchIndex(mode);
  const related = getRelatedPoems(poem, index);

  return (
    <div className={`page ${skin}`}>
      <div className="container">
        <ReaderBack />
        <PoemReader poem={poem} mode={mode} />
        <ShareActions poem={poem} />
        <RelatedSection poem={poem} initialRelated={related} mode={mode} />
      </div>
    </div>
  );
}
