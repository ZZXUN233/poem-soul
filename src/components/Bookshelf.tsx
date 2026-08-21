"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FilterBar from "./FilterBar";
import Pagination from "./Pagination";
import PoemCard from "./PoemCard";
import type { Poem } from "@/types";
import type { Mode } from "@/lib/mode";

interface BookshelfProps {
  mode: Mode;
  dynasties: string[];
  forms: string[];
}

interface BrowseResult {
  items: Poem[];
  total: number;
  page: number;
  totalPages: number;
}

/** 生成新随机 seed（改筛选/换随机顺序时用） */
function newSeed(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random());
}

/**
 * 首页「浏览全部」书架：浏览状态（collection/dynasty/form/page/seed）由 URL 驱动，
 * 与搜索页同款 syncUrl 模式。这样从诗歌点「返回」回首页时，能按 URL 里的
 * seed + 页码重新拉取同一批，位置与顺序精确保留。
 */
export default function Bookshelf({
  mode,
  dynasties,
  forms,
}: BookshelfProps) {
  const router = useRouter();
  const params = useSearchParams();

  const collection = params.get("collection") ?? "";
  const dynasty = params.get("dynasty") ?? undefined;
  const form = params.get("form") ?? undefined;
  // 无 seed 时给一个，首访/分享无 seed 也能稳定分页
  const seed = params.get("seed") ?? "";
  const page = Number(params.get("page") ?? 1) || 1;

  const [result, setResult] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);

  const syncUrl = useCallback(
    (updates: {
      collection?: string;
      dynasty?: string | undefined;
      form?: string | undefined;
      seed?: string;
      page?: number;
    }) => {
      const sp = new URLSearchParams();
      sp.set("mode", mode);
      const has = (k: string) =>
        Object.prototype.hasOwnProperty.call(updates, k);
      const nextCollection = has("collection")
        ? updates.collection
        : collection;
      const nextDynasty = has("dynasty") ? updates.dynasty : dynasty;
      const nextForm = has("form") ? updates.form : form;
      const nextSeed = has("seed") ? updates.seed : seed;
      const nextPage = has("page") ? updates.page : page;
      // 换筛选/换随机顺序时必然换新 seed；其余情况沿用当前 seed
      if (nextSeed) sp.set("seed", nextSeed);
      if (nextCollection) sp.set("collection", nextCollection);
      if (nextDynasty) sp.set("dynasty", nextDynasty);
      if (nextForm) sp.set("form", nextForm);
      if (nextPage && nextPage > 1) sp.set("page", String(nextPage));
      router.replace(`/?${sp.toString()}`);
    },
    [router, collection, dynasty, form, seed, page, mode]
  );

  const load = useCallback(
    async (
      coll: string,
      dyn: string | undefined,
      f: string | undefined,
      s: string,
      pg: number
    ) => {
      setLoading(true);
      const paramsQ = new URLSearchParams({
        mode,
        page: String(pg),
        pageSize: "20",
        sort: "random",
        seed: s,
      });
      if (coll) paramsQ.set("collection", coll);
      if (dyn) paramsQ.set("dynasty", dyn);
      if (f) paramsQ.set("form", f);
      try {
        const res = await fetch(`/api/browse?${paramsQ.toString()}`);
        const data = (await res.json()) as BrowseResult;
        setResult(data);
      } finally {
        setLoading(false);
      }
    },
    [mode]
  );

  useEffect(() => {
    load(collection, dynasty, form, seed, page);
  }, [collection, dynasty, form, seed, page, load]);

  // 改筛选 / 换随机顺序：换新 seed 并回到第 1 页，同步 URL
  const resetAndLoad = (
    coll: string,
    dyn: string | undefined,
    f: string | undefined
  ) => {
    syncUrl({ collection: coll, dynasty: dyn, form: f, seed: newSeed(), page: 1 });
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
                <PoemCard key={poem.id} poem={poem} mode={mode} />
              ))}
            </div>
          )}
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            onPageChange={(pg) => syncUrl({ page: pg })}
          />
        </>
      )}
    </section>
  );
}
