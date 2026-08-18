import { getMeta } from "@/lib/corpus";
import Bookshelf from "@/components/Bookshelf";
import DailyPoem from "@/components/DailyPoem";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ collection?: string; page?: string }>;
}

/** 首页 / 书架 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const sp = await searchParams;
  const meta = await getMeta();
  const initialCollection = sp.collection ?? "";

  return (
    <>
      <section className="hero">
        <h1>诗魂 · Poem Soul</h1>
        <p>行于诗卷，箸点平仄 —— 古诗词索引、展示与阅读</p>
        <div className="hero-stats">
          <div>
            <b>{meta.totalPoems.toLocaleString()}</b>
            <br />
            首诗词
          </div>
          <div>
            <b>{meta.totalChars.toLocaleString()}</b>
            <br />
            字正文
          </div>
        </div>
      </section>

      <DailyPoem />

      <Bookshelf
        dynasties={meta.allDynasties}
        forms={meta.allForms}
        initialCollection={initialCollection}
      />
    </>
  );
}
