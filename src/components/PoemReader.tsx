import Link from "next/link";
import type { Poem } from "@/types";
import { poemLines } from "@/lib/format";
import { authorHref, type Mode } from "@/lib/mode";

/** 阅读页正文：展示 title/author/dynasty/form + 正文（近体诗对仗对齐） */
export default function PoemReader({
  poem,
  mode = "classic",
}: {
  poem: Poem;
  mode?: Mode;
}) {
  const couplets = poemLines(poem.content, poem.form);
  // 现代诗分行自由，正文左对齐更自然；近体诗保持居中
  const modern = poem.dynasty === "现代";

  return (
    <article className={modern ? "reader reader-modern" : "reader"}>
      <h1 className="reader-title">{poem.title}</h1>
      <div className="reader-meta">
        <Link href={authorHref(poem.author, mode)} className="reader-author">
          {poem.author}
        </Link>
      </div>
      <div className="reader-badges">
        <span>{poem.dynasty}</span>
        {poem.year ? <span>{poem.year}</span> : null}
        <span>{poem.form || "体裁未知"}</span>
      </div>
      <hr className="reader-rule" aria-hidden="true" />

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
