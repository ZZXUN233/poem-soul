"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import PoemCard from "@/components/PoemCard";
import type { MatchKind, SearchHit, SearchResponse } from "@/types";

/** 命中 tab 选项 */
const MATCH_TABS: { key: MatchKind | ""; label: string }[] = [
  { key: "", label: "全部" },
  { key: "title", label: "命中标题" },
  { key: "author", label: "命中作者" },
  { key: "content", label: "命中正文" },
];

/** 搜索页客户端：URL 驱动（q/dynasty/form/match/page），可分享/直达 */
export default function SearchPage({
  dynasties,
  forms,
}: {
  dynasties: string[];
  forms: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const dynasty = params.get("dynasty") ?? undefined;
  const form = params.get("form") ?? undefined;
  const matchRaw = params.get("match") ?? "";
  const match: MatchKind | "" =
    matchRaw === "title" || matchRaw === "author" || matchRaw === "content"
      ? matchRaw
      : "";
  const page = Number(params.get("page") ?? 1) || 1;

  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const syncUrl = useCallback(
    (updates: {
      q?: string;
      dynasty?: string;
      form?: string;
      match?: MatchKind | "";
      page?: number;
    }) => {
      const sp = new URLSearchParams();
      const nextQ = updates.q ?? q;
      const nextDynasty = updates.dynasty ?? dynasty;
      const nextForm = updates.form ?? form;
      const nextMatch = updates.match ?? match;
      const nextPage = updates.page ?? page;
      if (nextQ) sp.set("q", nextQ);
      if (nextDynasty) sp.set("dynasty", nextDynasty);
      if (nextForm) sp.set("form", nextForm);
      if (nextMatch) sp.set("match", nextMatch);
      if (nextPage && nextPage > 1) sp.set("page", String(nextPage));
      router.push(`/search?${sp.toString()}`);
    },
    [router, q, dynasty, form, match, page]
  );

  const doSearch = useCallback(
    async (
      kw: string,
      dyn: string | undefined,
      f: string | undefined,
      mt: MatchKind | "",
      pg: number
    ) => {
      if (!kw) {
        setResult(null);
        return;
      }
      setLoading(true);
      const sp = new URLSearchParams({ q: kw, page: String(pg), pageSize: "20" });
      if (dyn) sp.set("dynasty", dyn);
      if (f) sp.set("form", f);
      if (mt) sp.set("match", mt);
      try {
        const res = await fetch(`/api/search?${sp.toString()}`);
        const data = (await res.json()) as SearchResponse;
        setResult(data);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (q) {
      doSearch(q, dynasty, form, match, page);
    }
  }, [q, dynasty, form, match, page, doSearch]);

  const onSearch = (kw: string) => {
    syncUrl({ q: kw, page: 1 });
  };

  return (
    <>
      <h1 className="reader-title" style={{ marginBottom: 4 }}>
        诗海寻珠
      </h1>
      <SearchBar defaultValue={q} onSearch={onSearch} />
      <FilterBar
        dynasties={dynasties}
        forms={forms}
        activeDynasty={dynasty}
        activeForm={form}
        onDynastyChange={(d) => syncUrl({ dynasty: d, page: 1 })}
        onFormChange={(f) => syncUrl({ form: f, page: 1 })}
      />

      {!q && (
        <div className="notice">
          输入标题、作者或诗句，在全唐诗、宋词、元曲等 7.6 万余首中检索。
        </div>
      )}

      {loading && <div className="empty">检索中…</div>}

      {!loading && result && (
        <>
          <div className="search-meta">
            关键词「{result.q}」共命中 {result.total.toLocaleString()} 首
          </div>

          <div className="match-tabs">
            {MATCH_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`match-tab ${match === tab.key ? "active" : ""}`}
                onClick={() => syncUrl({ match: tab.key, page: 1 })}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {result.total === 0 ? (
            <div className="empty">未找到匹配的诗词，换个关键词试试</div>
          ) : (
            <div className="poem-list">
              {result.hits.map((hit: SearchHit) => (
                <PoemCard
                  key={hit.poem.id}
                  poem={hit.poem}
                  snippet={hit.snippet}
                  titleMarked={hit.titleMarked}
                  authorMarked={hit.authorMarked}
                  matchKind={hit.matchKind}
                />
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
    </>
  );
}

