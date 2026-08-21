"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Poem } from "@/types";
import { poemHref, type Mode } from "@/lib/mode";
import { poemLines } from "@/lib/format";
import {
  addFavorite,
  getFavorites,
  isFavorite,
  removeFavorite,
} from "@/lib/favorites";

/** 一叠初始抽取张数 */
const BATCH = 12;
/** 剩余不足此数时续叠 */
const TOP_UP_AT = 3;

interface CardDeckProps {
  mode: Mode;
}

interface DeckSwipe {
  /** 前往的方向："like"(收藏) | "skip"(跳过)，null = 无 */
  dir: "like" | "skip" | null;
}

/**
 * 抽卡模式：全屏卡片堆叠，通过底部按钮「跳过 / 收藏」操作（响应式更稳），
 * 收藏记录到 localStorage；剩余不足自动续叠。
 */
export default function CardDeck({ mode }: CardDeckProps) {
  const router = useRouter();

  const [deck, setDeck] = useState<Poem[]>([]);
  const [top, setTop] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [favTick, setFavTick] = useState(0);
  // 飞出动画目标：非 null 时顶卡向右上/左下飞出后推进
  const [fly, setFly] = useState<DeckSwipe>({ dir: null });
  // 「我的收藏」面板
  const [favOpen, setFavOpen] = useState(false);
  const [favPoems, setFavPoems] = useState<Poem[]>([]);
  const [favLoading, setFavLoading] = useState(false);

  const stateRef = useRef({ deck, top });
  stateRef.current = { deck, top };
  const inFlightRef = useRef(false);

  const loadBatch = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const seed = crypto.randomUUID();
      const res = await fetch(
        `/api/cards?mode=${encodeURIComponent(mode)}&seed=${encodeURIComponent(
          seed
        )}&count=${BATCH}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { poems: Poem[] };
      setDeck((prev) => [...prev, ...data.poems]);
    } catch {
      /* 静默 */
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [mode]);

  // 首次加载 + 剩余不足时续叠
  useEffect(() => {
    if (stateRef.current.deck.length - stateRef.current.top <= TOP_UP_AT) {
      loadBatch();
    }
  }, [deck.length, top, loadBatch]);

  /** 提交一次飞出：dir=like 收藏，dir=skip 跳过；动画由定时器推进（不依赖 transitionend，避免卡锁） */
  const swipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitSwipe = useCallback((dir: "like" | "skip") => {
    const poem = stateRef.current.deck[stateRef.current.top];
    if (!poem || locked) return;
    if (dir === "like") {
      addFavorite(poem.id);
      setFavTick((t) => t + 1);
    }
    setFly({ dir });
    setLocked(true);
    // 动画结束后固定推进：新顶卡回到不透明/原位，解锁
    if (swipeTimerRef.current) clearTimeout(swipeTimerRef.current);
    swipeTimerRef.current = setTimeout(() => {
      setTop((t) => t + 1);
      setFly({ dir: null });
      setLocked(false);
      swipeTimerRef.current = null;
    }, 340);
  }, [locked]);

  const close = () => {
    if (typeof window !== "undefined" && window.history.length <= 1) {
      router.replace("/");
    } else {
      router.back();
    }
  };

  const toggleFavorites = useCallback(async () => {
    const willOpen = !favOpen;
    setFavOpen(willOpen);
    if (willOpen) {
      const ids = getFavorites();
      if (ids.length === 0) {
        setFavPoems([]);
        return;
      }
      setFavLoading(true);
      try {
        const res = await fetch(
          `/api/favorites?mode=${encodeURIComponent(
            mode
          )}&ids=${encodeURIComponent(ids.join(","))}`
        );
        if (res.ok) {
          const data = (await res.json()) as { poems: Poem[] };
          setFavPoems(data.poems);
        }
      } catch {
        /* 静默 */
      } finally {
        setFavLoading(false);
      }
    }
  }, [favOpen, mode]);

  const unFavorite = useCallback((id: string) => {
    removeFavorite(id);
    setFavPoems((prev) => prev.filter((p) => p.id !== id));
    setFavTick((t) => t + 1);
  }, []);

  const current = stateRef.current.deck[stateRef.current.top];
  const visible: { poem: Poem; index: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const p = stateRef.current.deck[stateRef.current.top + i];
    if (p) visible.push({ poem: p, index: i });
  }
  const isEmpty = !loading && visible.length === 0;

  return (
    <div className="card-stage">
      <div className="card-toolbar">
        <button
          type="button"
          className="card-close"
          onClick={close}
          aria-label="关闭抽卡"
          title="关闭"
        >
          ✕
        </button>
        <div className="card-toolbar-right">
          <span className="card-mode-label">
            {mode === "modern" ? "现代诗 · 抽卡" : "古诗词 · 抽卡"}
          </span>
          <button
            type="button"
            className={`card-fav-btn ${favOpen ? "active" : ""}`}
            onClick={() => toggleFavorites()}
            aria-label="我的收藏"
            title="我的收藏"
          >
            ♥
          </button>
        </div>
      </div>

      {loading && visible.length === 0 && (
        <div className="card-loading">洗牌中…</div>
      )}

      {isEmpty && (
        <div className="card-empty">
          <div>牌抽完了</div>
          <button type="button" className="card-redeal" onClick={loadBatch}>
            再抽一叠
          </button>
        </div>
      )}

      {visible.length > 0 && (
        <div className="card-deck">
          {visible.map(({ poem, index }) => {
            const isTop = index === 0;
            let style: React.CSSProperties;
            if (isTop) {
              // 顶卡：zIndex 最高；飞出动画用 CSS keyframes（card-fly-*/card-top），
              // 由定时器推进 top 后重置回 static，绝不叠加残留
              style = { zIndex: 3 };
            } else if (index === 1) {
              style = {
                zIndex: 2,
                pointerEvents: "none",
                transform: "translateY(10px) scale(0.98)",
                opacity: 0.7,
              };
            } else {
              style = {
                zIndex: 1,
                pointerEvents: "none",
                transform: "translateY(20px) scale(0.96)",
                opacity: 0.5,
              };
            }
            const flyClass = isTop
              ? fly.dir
                ? fly.dir === "like"
                  ? "card-fly-like"
                  : "card-fly-skip"
                : "card-top"
              : "";
            return (
              <div
                key={`${poem.id}-${stateRef.current.top}-${index}`}
                className={`card card-depth ${flyClass}`}
                style={style}
              >
                <CardBody poem={poem} favorited={isFavorite(poem.id)} />
              </div>
            );
          })}
        </div>
      )}

      {!isEmpty && visible.length > 0 && (
        <div className="deck-actions">
          <button
            type="button"
            className="deck-btn deck-skip"
            onClick={() => commitSwipe("skip")}
            disabled={locked}
          >
            <span aria-hidden="true">←</span> 跳过
          </button>
          <span className="deck-hint">
            跳过 / 收藏 · 收藏会存入本地
          </span>
          <button
            type="button"
            className="deck-btn deck-like"
            onClick={() => commitSwipe("like")}
            disabled={locked}
          >
            收藏 <span aria-hidden="true">♥</span>
          </button>
        </div>
      )}

      {favOpen && (
        <div className="fav-drawer">
          <div className="fav-drawer-head">
            <span className="fav-drawer-title">我的收藏</span>
            <button
              type="button"
              className="fav-drawer-close"
              onClick={() => setFavOpen(false)}
              aria-label="关闭我的收藏"
            >
              ✕
            </button>
          </div>
          {favLoading ? (
            <div className="fav-empty">加载中…</div>
          ) : favPoems.length === 0 ? (
            <div className="fav-empty">还没有收藏，去右滑收藏几首吧 🎴</div>
          ) : (
            <ul className="fav-list">
              {favPoems.map((p) => {
                const poemMode: Mode = p.id.startsWith("xian_dai-")
                  ? "modern"
                  : "classic";
                return (
                  <li key={p.id} className="fav-item">
                    <Link
                      href={poemHref(p.id, poemMode)}
                      className="fav-item-main"
                    >
                      <span className="fav-item-title">{p.title}</span>
                      <span className="fav-item-meta">
                        {p.author}
                        {p.dynasty ? ` · ${p.dynasty}` : ""}
                        {p.form ? ` · ${p.form}` : ""}
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="fav-item-remove"
                      onClick={() => unFavorite(p.id)}
                      aria-label={`取消收藏 ${p.title}`}
                      title="取消收藏"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** 单张诗卡正文：复用 poemLines 对仗排版，现代诗左对齐 */
function CardBody({ poem, favorited }: { poem: Poem; favorited: boolean }) {
  const couplets = poemLines(poem.content, poem.form);
  const modern = poem.dynasty === "现代";

  return (
    <article className={`card-verso ${modern ? "card-modern" : ""}`}>
      <div className="card-verso-head">
        {favorited && <span className="card-faved">♥ 已藏</span>}
      </div>
      <h2 className="card-title">{poem.title}</h2>
      <div className="card-meta">
        {poem.author}
        {poem.dynasty ? ` · ${poem.dynasty}` : ""}
        {poem.form ? ` · ${poem.form}` : ""}
        {poem.year ? ` · ${poem.year}` : ""}
      </div>
      <div className="card-rule" aria-hidden="true" />
      {couplets ? (
        <div className="card-jushi">
          {couplets.map((pair, i) => (
            <div className="card-couplet" key={i}>
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
        <div className="card-content">{poem.content}</div>
      )}
    </article>
  );
}
