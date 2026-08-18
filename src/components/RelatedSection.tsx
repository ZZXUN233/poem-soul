"use client";

import { useState } from "react";
import Link from "next/link";
import type { Poem } from "@/types";
import type { RelatedField, RelatedPoems } from "@/lib/related";
import { hasRelated } from "@/lib/related";

interface RelatedSectionProps {
  poem: Poem;
  initialRelated: RelatedPoems;
}

/** 词/曲的 title 即词牌/曲牌，「同名」应表述为「同词牌/同曲牌」 */
function titleSectionLabel(poem: Poem): string {
  if (poem.form === "词") return "同词牌";
  if (poem.form === "曲") return "同曲牌";
  return "同名诗";
}

/** 为方便点击「换一批」，把三类各映射到标签与「换一批」取批字段 */
interface GroupDef {
  field: RelatedField;
  label: string;
}

/** 阅读页正文下方的相关推荐（每类支持「换一批」） */
export default function RelatedSection({
  poem,
  initialRelated,
}: RelatedSectionProps) {
  const [related, setRelated] = useState<RelatedPoems>(initialRelated);
  const [loading, setLoading] = useState<RelatedField | null>(null);

  if (!hasRelated(related)) return null;

  const groups: GroupDef[] = [];
  if (related.form.length > 0)
    groups.push({ field: "form", label: `同类 · ${poem.form || "体裁"}` });
  if (related.author.length > 0)
    groups.push({ field: "author", label: `同作者 · ${poem.author}` });
  if (related.title.length > 0)
    groups.push({
      field: "title",
      label: `${titleSectionLabel(poem)} · ${poem.title}`,
    });

  async function refresh(field: RelatedField) {
    if (loading) return;
    setLoading(field);
    try {
      const seed = Math.random().toString(36).slice(2);
      const res = await fetch(
        `/api/related?id=${encodeURIComponent(poem.id)}&field=${field}&seed=${seed}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { items: Poem[] };
      setRelated((prev) => ({ ...prev, [field]: data.items }));
    } catch {
      // 网络/解析失败静默处理，保留原批
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="related">
      <h2 className="section-title">相关推荐</h2>

      {groups.map((g) => (
        <div className="related-group" key={g.field}>
          <div className="related-head">
            <h3 className="related-label">{g.label}</h3>
            <button
              type="button"
              className="related-refresh"
              disabled={loading === g.field}
              onClick={() => refresh(g.field)}
            >
              {loading === g.field ? "换一批…" : "换一批 ↻"}
            </button>
          </div>
          <div className="related-list">
            {related[g.field].map((p) => (
              <Link key={p.id} href={`/poem/${p.id}`} className="related-item">
                <span className="related-item-title">{p.title}</span>
                <span className="related-item-author">
                  {p.author} · {p.dynasty}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
