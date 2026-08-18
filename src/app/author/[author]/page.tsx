import Link from "next/link";
import { getSearchIndex } from "@/lib/corpus";
import { isMode, type Mode } from "@/lib/mode";
import PoemCard from "@/components/PoemCard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/** 安全解码动态段（含非法编码时原样返回） */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

interface AuthorPageProps {
  params: Promise<{ author: string }>;
  searchParams: Promise<{ mode?: string; page?: string }>;
}

/** 作者作品页：按作者过滤当前模式语料，分页展示该作者全部诗作 */
export default async function AuthorPage({
  params,
  searchParams,
}: AuthorPageProps) {
  const { author: rawAuthor } = await params;
  // 动态段可能以 URL 编码形式到达（如 %E6%B5%B7），安全解码
  const author = rawAuthor.includes("%")
    ? safeDecode(rawAuthor)
    : rawAuthor;
  const sp = await searchParams;
  const mode: Mode = isMode(sp.mode) ? sp.mode : "classic";
  const page = Number(sp.page ?? 1) || 1;

  const index = await getSearchIndex(mode);
  const works = index.filter((p) => p.author === author);
  const total = works.length;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const items = works.slice(
    (pageClamped - 1) * PAGE_SIZE,
    pageClamped * PAGE_SIZE
  );

  const base = `/author/${encodeURIComponent(author)}?mode=${mode}`;

  return (
    <section className="author-page">
      <h1 className="reader-title">{author}</h1>
      <div className="search-meta">
        共 {total.toLocaleString()} 首 · {mode === "modern" ? "现代诗" : "古诗词"}
      </div>
      <div className="poem-list">
        {items.map((poem) => (
          <PoemCard key={poem.id} poem={poem} mode={mode} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          {pageClamped > 1 ? (
            <Link href={`${base}&page=${pageClamped - 1}`}>上一页</Link>
          ) : (
            <span className="disabled">上一页</span>
          )}
          <span>
            第 <span className="current">{pageClamped}</span> / {totalPages} 页
          </span>
          {pageClamped < totalPages ? (
            <Link href={`${base}&page=${pageClamped + 1}`}>下一页</Link>
          ) : (
            <span className="disabled">下一页</span>
          )}
        </div>
      )}
    </section>
  );
}
