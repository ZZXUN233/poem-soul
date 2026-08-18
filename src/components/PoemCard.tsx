import Link from "next/link";
import type { Poem } from "@/types";

interface PoemCardProps {
  poem: Poem;
  /** 命中高亮片段（已含 <mark>，来自服务端），可选 */
  snippet?: string;
  titleMarked?: string;
  authorMarked?: string;
  matchKind?: "title" | "author" | "content";
}

const KIND_LABEL: Record<string, string> = {
  title: "标题命中",
  author: "作者命中",
  content: "正文命中",
};

export default function PoemCard({
  poem,
  snippet,
  titleMarked,
  authorMarked,
  matchKind,
}: PoemCardProps) {
  // 展示标题：优先高亮标题
  const displayTitle = titleMarked ?? poem.title;
  const displayAuthor = authorMarked ?? poem.author;

  // 由全角标点切句，取前两句作预览（无命中片段时）
  const firstLine = poem.content.split(/[。！？；]/)[0] ?? "";

  return (
    <Link href={`/poem/${poem.id}`} className="poem-card">
      <div className="poem-card-head">
        <span
          className="poem-card-title"
          dangerouslySetInnerHTML={{ __html: displayTitle }}
        />
        <span
          className="poem-card-author"
          dangerouslySetInnerHTML={{ __html: displayAuthor }}
        />
        {matchKind && <span className="match-kind">{KIND_LABEL[matchKind]}</span>}
      </div>
      <div className="poem-card-meta">
        {poem.dynasty} · {poem.form || "体裁未知"}
      </div>
      <div className="poem-card-content">
        {snippet ? (
          <span dangerouslySetInnerHTML={{ __html: snippet }} />
        ) : (
          firstLine
        )}
      </div>
    </Link>
  );
}
