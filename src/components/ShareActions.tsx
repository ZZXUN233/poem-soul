"use client";

import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import type { Poem } from "@/types";
import { poemLines } from "@/lib/format";

/** 可读正文：近体诗按对仗成行，其余原样 */
function readableContent(poem: Poem): string {
  const couplets = poemLines(poem.content, poem.form);
  if (couplets) {
    return couplets
      .map((pair) => pair.map(({ chars, punct }) => chars + punct).join(""))
      .join("\n");
  }
  return poem.content;
}

/** 分享/复制用的完整文本 */
function buildShareText(poem: Poem, url: string): string {
  const meta = [poem.dynasty, poem.year, poem.form || "体裁未知"]
    .filter(Boolean)
    .join(" · ");
  return `${poem.title}\n${poem.author} · ${meta}\n\n${readableContent(poem)}\n\n—— 来自 诗魂 Poem Soul\n${url}`;
}

/** 阅读页操作栏：复制内容 / 截图分享 / 复制链接 */
export default function ShareActions({ poem }: { poem: Poem }) {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null); // 截图预览 URL

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 1800);
  };

  const copyContent = async () => {
    try {
      await navigator.clipboard.writeText(
        buildShareText(poem, window.location.href)
      );
      showToast("已复制诗文");
    } catch {
      showToast("复制失败");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("链接已复制");
    } catch {
      showToast("复制失败");
    }
  };

  /** 生成截图并弹出预览 */
  const generateScreenshot = async () => {
    const node = shareCardRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const blob = await toBlob(node, {
        pixelRatio: 2,
        backgroundColor: "#faf7f0",
      });
      if (!blob) throw new Error("no blob");
      const url = URL.createObjectURL(blob);
      setPreview(url);
    } catch {
      showToast("截图生成失败");
    } finally {
      setBusy(false);
    }
  };

  /** 复制截图到剪贴板 */
  const copyScreenshot = async () => {
    if (!preview) return;
    try {
      const res = await fetch(preview);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      showToast("已复制截图");
    } catch {
      showToast("复制失败");
    }
  };

  /** 保存截图到本地 */
  const saveScreenshot = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = `${poem.title || "poem"}.png`;
    a.click();
    showToast("已保存");
  };

  /** 关闭预览 */
  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  return (
    <>
      <div className="share-actions">
        <button onClick={copyContent} title="复制诗词全文" className="share-btn">
          复制内容
        </button>
        <button
          onClick={generateScreenshot}
          title="生成分享图片"
          className="share-btn"
          disabled={busy}
        >
          {busy ? "生成中…" : "截图分享"}
        </button>
        <button onClick={copyLink} title="复制当前链接" className="share-btn">
          复制链接
        </button>
      </div>

      {/* 离屏分享卡：供 html-to-image 截图，不占可视布局 */}
      <div className="share-card-frame" aria-hidden>
        <div ref={shareCardRef} className="share-card">
          <div className="share-card-title">{poem.title}</div>
          <div className="share-card-meta">
            {poem.author} ·{" "}
            {[poem.dynasty, poem.year, poem.form || "体裁未知"]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <ShareCardBody poem={poem} />
          <div className="share-card-brand">
            <span className="share-card-brand-mark">詩</span> 诗魂 Poem Soul
          </div>
        </div>
      </div>

      {/* 截图预览弹窗 */}
      {preview && (
        <div className="screenshot-overlay" onClick={closePreview}>
          <div
            className="screenshot-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="screenshot-modal-header">
              <span>截图预览</span>
              <button className="screenshot-close" onClick={closePreview}>
                ✕
              </button>
            </div>
            <div className="screenshot-preview">
              <img src={preview} alt={`${poem.title} 截图`} />
            </div>
            <div className="screenshot-actions">
              <button className="screenshot-btn" onClick={copyScreenshot}>
                📋 复制图片
              </button>
              <button className="screenshot-btn" onClick={saveScreenshot}>
                💾 保存本地
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="share-toast">{toast}</div>}
    </>
  );
}

/** 分享卡正文（近体诗对仗成行，其余原样） */
function ShareCardBody({ poem }: { poem: Poem }) {
  const couplets = poemLines(poem.content, poem.form);
  if (couplets) {
    return (
      <div className="share-card-content couplets">
        {couplets.map((pair, i) => (
          <div className="share-couplet" key={i}>
            <span>{pair[0].chars}</span>
            <span className="share-couplet-tail">
              {pair[0].punct}
              {pair[1]?.chars}
              {pair[1]?.punct}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <div className="share-card-content">{poem.content}</div>;
}
