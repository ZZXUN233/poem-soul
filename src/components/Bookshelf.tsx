"use client";

import { useCallback, useEffect, useState } from "react";
import FilterBar from "./FilterBar";
import Pagination from "./Pagination";
import PoemCard from "./PoemCard";
import type { Poem } from "@/types";

interface BookshelfProps {
  dynasties: string[];
  forms: string[];
  initialCollection?: string;
}

interface BrowseResult {
  items: Poem[];
  total: number;
  page: number;
  totalPages: number;
}

export default function Bookshelf({
  dynasties,
  forms,
  initialCollection = "",
}: BookshelfProps) {
  const [collection, setCollection] = useState(initialCollection);
  const [dynasty, setDynasty] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  // 随机排序 seed：每次挂载/改筛选生成新 seed → 首页不再固定从曹操开始，
  // 同一 seed 内跨页稳定
  const [seed, setSeed] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Math.random())
  );
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (
      coll: string,
      dyn: string | undefined,
      f: string | undefined,
      s: string,
      pg: number
    ) => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(pg),
        pageSize: "20",
        sort: "random",
        seed: s,
      });
      if (coll) params.set("collection", coll);
      if (dyn) params.set("dynasty", dyn);
      if (f) params.set("form", f);
      try {
        const res = await fetch(`/api/browse?${params.toString()}`);
        const data = (await res.json()) as BrowseResult;
        setResult(data);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(collection, dynasty, form, seed, page);
  }, [collection, dynasty, form, seed, page, load]);

  // 改筛选时换新 seed，随机打乱顺序
  const resetAndLoad = (coll: string, dyn?: string, f?: string) => {
    setCollection(coll);
    setDynasty(dyn);
    setForm(f);
    setSeed(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Math.random())
    );
    setPage(1);
  };

  return (
    <section>
      <h2 className="section-title">浏览全部</h2>
      <FilterBar
        dynasties={dynasties}
        forms={forms}
        activeDynasty={dynasty}
        activeForm={form}
        onDynastyChange={(d) => resetAndLoad(collection, d, form)}
        onFormChange={(f) => resetAndLoad(collection, dynasty, f)}
      />
      {loading && <div className="empty">加载中…</div>}
      {!loading && result && (
        <>
          <div className="search-meta">
            共 {result.total.toLocaleString()} 首
            {collection && ` · 已选诗卷`}
          </div>
          {result.items.length === 0 ? (
            <div className="empty">该筛选条件下暂无诗词</div>
          ) : (
            <div className="poem-list">
              {result.items.map((poem) => (
                <PoemCard key={poem.id} poem={poem} />
              ))}
            </div>
          )}
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
