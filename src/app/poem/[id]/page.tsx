import { notFound } from "next/navigation";
import { getPoemById, getSearchIndex } from "@/lib/corpus";
import { getRelatedPoems } from "@/lib/related";
import PoemReader from "@/components/PoemReader";
import ShareActions from "@/components/ShareActions";
import RelatedSection from "@/components/RelatedSection";

export const dynamic = "force-dynamic";

interface ReaderPageProps {
  params: Promise<{ id: string }>;
}

/** 阅读页：按稳定 id（如 tang-000001）展示单首诗词 + 分享 + 相关推荐 */
export default async function ReaderPage({ params }: ReaderPageProps) {
  const { id } = await params;
  const poem = await getPoemById(id);
  if (!poem) {
    notFound();
  }

  // 相关推荐：同类/同作者/同名（全库线性扫，search index 已缓存）
  const index = await getSearchIndex();
  const related = getRelatedPoems(poem, index);

  return (
    <>
      <PoemReader poem={poem} />
      <ShareActions poem={poem} />
      <RelatedSection poem={poem} initialRelated={related} />
    </>
  );
}
