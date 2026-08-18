import Link from "next/link";
import type { Poem } from "@/types";

/** 阅读页正文：展示 title/author/dynasty/form + 分句正文 */
export default function PoemReader({ poem }: { poem: Poem }) {
  return (
    <article className="reader">
      <h1 className="reader-title">{poem.title}</h1>
      <div className="reader-meta">{poem.author}</div>
      <div className="reader-badges">
        <span>{poem.dynasty}</span>
        <span>{poem.form || "体裁未知"}</span>
      </div>
      <div className="reader-content">{poem.content}</div>

      <div className="reader-ai">
        ✨ 诗魂 AI 玩法即将上线 —— 格律 / 平仄 / 韵脚赏析与智能问答
        <br />
        <Link href="/ai" style={{ color: "var(--accent-soft)" }}>
          前往诗魂 AI →
        </Link>
      </div>
    </article>
  );
}
