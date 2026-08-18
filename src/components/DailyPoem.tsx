"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Poem } from "@/types";
import { poemLines } from "@/lib/format";
import { poemHref, type Mode } from "@/lib/mode";

/** 每次刷新都不同的 seed：基于当前时间戳 */
function freshSeed(): string {
  return Date.now().toString(36);
}

/** 首页「每日一首」：全诗库随机一首，可重摇换诗 */
export default function DailyPoem({ mode }: { mode: Mode }) {
  const [poem, setPoem] = useState<Poem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (seed: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/random?mode=${encodeURIComponent(mode)}&seed=${encodeURIComponent(seed)}`
      );
      const data = (await res.json()) as Poem;
      setPoem(data);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  // 首次加载：每日一首（按日期稳定）
  useEffect(() => {
    load(freshSeed());
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
        <h2 className="section-title">随机一首</h2>
        <button className="daily-shuffle" onClick={shuffle} title="随机换一首">
          🎲 重摇
        </button>
      </div>

      {loading && <div className="empty">正在取诗…</div>}

      {!loading && poem && (
        <div className="daily-card">
          <div className="reader-title">{poem.title}</div>
          <div className="reader-meta">
            {poem.author} · {poem.dynasty}
            {poem.year ? ` · ${poem.year}` : ""}
            {poem.form ? ` · ${poem.form}` : ""}
          </div>
          <PoemBody poem={poem} />
          <div className="daily-read">
            <Link href={poemHref(poem.id, mode)}>查看全文 →</Link>
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
