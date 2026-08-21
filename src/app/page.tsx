import { getMeta } from "@/lib/corpus";
import { isMode, type Mode } from "@/lib/mode";
import Bookshelf from "@/components/Bookshelf";
import DailyPoem from "@/components/DailyPoem";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ mode?: string }>;
}

/** 首页 / 书架 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const sp = await searchParams;
  const mode: Mode = isMode(sp.mode) ? sp.mode : "classic";
  const meta = await getMeta(mode);
  const skin = mode === "modern" ? "page-modern" : "page-classic";

  return (
    <div className={`page ${skin}`}>
      <div className="container">
        <section className="hero">
          <span className="eyebrow">
            {mode === "modern" ? "当代诗卷 · Modern Verse" : "行于诗卷 · 箸点平仄"}
          </span>
          <span className="brand-seal" aria-hidden="true">詩</span>
          <h1>{mode === "modern" ? "诗魂 · Poem Soul" : "诗魂"}</h1>
          <p className="lede">
            {mode === "modern"
              ? "自由分行，现代诗的辽阔与况味。"
              : "古诗词索引、展示与阅读——全唐诗、宋词、元曲，离线自足。"}
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <b>{meta.totalPoems.toLocaleString()}</b>
              首{mode === "modern" ? "现代诗" : "诗词"}
            </div>
            <div className="hero-stat">
              <b>{meta.totalChars.toLocaleString()}</b>
              字正文
            </div>
          </div>
        </section>

        <DailyPoem mode={mode} />

        <Bookshelf
          mode={mode}
          dynasties={meta.allDynasties}
          forms={meta.allForms}
        />
      </div>
    </div>
  );
}
