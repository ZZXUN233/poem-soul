import type { Poem } from "@/types";
import { poemLines } from "@/lib/format";

/** 阅读页正文：展示 title/author/dynasty/form + 正文（近体诗对仗对齐） */
export default function PoemReader({ poem }: { poem: Poem }) {
  const couplets = poemLines(poem.content, poem.form);

  return (
    <article className="reader">
      <h1 className="reader-title">{poem.title}</h1>
      <div className="reader-meta">{poem.author}</div>
      <div className="reader-badges">
        <span>{poem.dynasty}</span>
        <span>{poem.form || "体裁未知"}</span>
      </div>

      {couplets ? (
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
      ) : (
        <div className="reader-content">{poem.content}</div>
      )}
    </article>
  );
}
