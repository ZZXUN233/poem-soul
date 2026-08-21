import { isMode, type Mode } from "@/lib/mode";
import CardDeck from "@/components/CardDeck";

export const dynamic = "force-dynamic";

interface CardsPageProps {
  searchParams: Promise<{ mode?: string }>;
}

/** 抽卡模式：全屏，按当前语料模式随机一叠诗卡（沉浸式左右滑） */
export default async function CardsPage({ searchParams }: CardsPageProps) {
  const sp = await searchParams;
  const mode: Mode = isMode(sp.mode) ? sp.mode : "classic";
  const skin = mode === "modern" ? "page-modern" : "page-classic";
  return (
    <div className={`page cards-page ${skin}`}>
      <CardDeck mode={mode} />
    </div>
  );
}
