"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_MODE, isMode, type Mode } from "@/lib/mode";

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "classic", label: "古诗词" },
  { value: "modern", label: "现代诗" },
];

/** 在诗歌详情页等语料库专属路径切换模式时，回退到首页 */
function switchTarget(pathname: string, m: Mode): string {
  if (pathname.startsWith("/poem/") || pathname.startsWith("/author/")) {
    return m === DEFAULT_MODE ? "/" : `/?mode=${m}`;
  }
  return pathname;
}

/** 导航栏模式开关：古诗词 / 现代诗 一键切换（由 URL ?mode= 驱动，缺省为古诗词） */
export default function ModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramMode = searchParams.get("mode");
  // 模式完全由 URL 决定：无 ?mode= 时默认古诗词，不做 localStorage 覆盖
  // （保证与服务端渲染的正文模式一致，避免"标题显示现代诗、内容是古诗词"的错位）
  const [current, setCurrent] = useState<Mode>(
    isMode(paramMode) ? paramMode : DEFAULT_MODE
  );

  const switchTo = (m: Mode) => {
    if (m === current) return;
    setCurrent(m);
    let query: URLSearchParams;
    let base: string;
    if (pathname === "/search") {
      // 搜索页切换模式：清空搜索条件（q/朝代/体裁/命中/页码），仅保留 mode
      query = new URLSearchParams();
      query.set("mode", m);
      base = pathname;
    } else {
      base = switchTarget(pathname, m);
      query = new URLSearchParams(searchParams.toString());
      query.set("mode", m);
    }
    router.push(`${base}?${query.toString()}`);
  };

  return (
    <div className="mode-toggle" role="group" aria-label="语料模式">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`mode-pill ${current === opt.value ? "active" : ""}`}
          onClick={() => switchTo(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
