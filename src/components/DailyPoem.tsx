"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Poem } from "@/types";
import { poemLines } from "@/lib/format";

/** 今日日期（客户端时区），作为每日定首的 seed */
function todaySeed(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 首页「每日一首」：全诗库随机一首，可重摇换诗 */
export default function DailyPoem() {
  const [poem, setPoem] = useState<Poem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (seed: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/random?seed=${encodeURIComponent(seed)}`);
      const data = (await res.json()) as Poem;
      setPoem(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // 首次加载：每日一首（按日期稳定）
  useEffect(() => {
    load(todaySeed());
  }, [load]);

  const shuffle = () => {
    // 重摇：随机 seed 换一首
    load(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Math.random())
    );
  };

  return (
    <section className="daily-poem">
      <div className="daily-head">
        <h2 className="section-title">每日一首</h2>
        <button className="daily-shuffle" onClick={shuffle} title="随机换一首">
          🎲 重摇
        </button>
      </div>

      {loading && <div className="empty">正在取诗…</div>}

      {!loading && poem && (
        <div className="daily-card">
          <div className="reader-title">{poem.title}</div>
          <div className="reader-meta">
            {poem.author} · {poem.dynasty} · {poem.form || "体裁未知"}
          </div>
          <PoemBody poem={poem} />
          <div className="daily-read">
            <Link href={`/poem/${poem.id}`}>查看全文 →</Link>
          </div>
        </div>
      )}
    </section>
  );
}

/** 正文渲染：近体诗短体用对仗对齐，其余原样 */
function PoemBody({ poem }: { poem: Poem }) {
  const couplets = poemLines(poem.content, poem.form);
  if (couplets) {
    return (
      <div className="reader-jushi">
        {couplets.map((pair, i) => (
          <div className="couplet" key={i}>
            <span className="out">{pair[0].chars}</span>
            <span className="in">
              {pair[0].punct}
              {pair[1]?.chars}
              {pair[1]?.punct}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <div className="reader-content">{poem.content}</div>;
}
