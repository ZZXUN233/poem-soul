import { notFound } from "next/navigation";
import { getPoemById } from "@/lib/corpus";
import PoemReader from "@/components/PoemReader";

export const dynamic = "force-dynamic";

interface ReaderPageProps {
  params: Promise<{ id: string }>;
}

/** 阅读页：按稳定 id（如 tang-000001）展示单首诗词 */
export default async function ReaderPage({ params }: ReaderPageProps) {
  const { id } = await params;
  const poem = await getPoemById(id);
  if (!poem) {
    notFound();
  }
  return <PoemReader poem={poem} />;
}
