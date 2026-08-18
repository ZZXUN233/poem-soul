import Link from "next/link";
import type { Poem } from "@/types";
import { DEFAULT_MODE, poemHref, type Mode } from "@/lib/mode";

interface PoemCardProps {
  poem: Poem;
  /** 命中高亮片段（已含 <mark>，来自服务端），可选 */
  snippet?: string;
  titleMarked?: string;
  authorMarked?: string;
  matchKind?: "title" | "author" | "content";
  /** 所在数据模式（决定链接是否带 ?mode=） */
  mode?: Mode;
}

const KIND_LABEL: Record<string, string> = {
  title: "标题命中",
  author: "作者命中",
  content: "正文命中",
};

/** 无命中片段时的卡片预览：现代诗有换行结构 → 截前两行；其余取首句 */
const PREVIEW_LINES = 2;
const PREVIEW_MAX_CHARS = 60;

function previewText(content: string): string {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    const excerpt = lines.slice(0, PREVIEW_LINES).join("\n");
    if (excerpt.length <= PREVIEW_MAX_CHARS) return excerpt;
    return `${excerpt.slice(0, PREVIEW_MAX_CHARS).replace(/\s+\S*$/, "")}…`;
  }
  return content.split(/[。！？；]/)[0] ?? "";
}

export default function PoemCard({
  poem,
  snippet,
  titleMarked,
  authorMarked,
  matchKind,
  mode = DEFAULT_MODE,
}: PoemCardProps) {
  // 展示标题：优先高亮标题
  const displayTitle = titleMarked ?? poem.title;
  const displayAuthor = authorMarked ?? poem.author;

  return (
    <Link href={poemHref(poem.id, mode)} className="poem-card">
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
        {poem.dynasty}
        {poem.year ? ` · ${poem.year}` : ""}
        {poem.form ? ` · ${poem.form}` : ""}
      </div>
      <div className="poem-card-content">
        {snippet ? (
          <span dangerouslySetInnerHTML={{ __html: snippet }} />
        ) : (
          previewText(poem.content)
        )}
      </div>
    </Link>
  );
}
