"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_MODE, isMode, type Mode } from "@/lib/mode";

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "classic", label: "古诗词" },
  { value: "modern", label: "现代诗" },
];

/** 在诗歌详情页等语料库专属路径切换模式时，回退到首页（只返回裸路径，query 由调用方拼接，避免 mode 重复） */
function switchTarget(pathname: string): string {
  if (pathname.startsWith("/poem/") || pathname.startsWith("/author/")) {
    return "/";
  }
  return pathname;
}

/** 导航栏模式开关：古诗词 / 现代诗 一键切换（由 URL ?mode= 驱动，缺省为古诗词） */
export default function ModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramMode = searchParams.get("mode");
  // 当前模式完全由 URL 推导（无 ?mode= 时缺省为古诗词），不维护本地 state，
  // 这样服务端导航/浏览器返回/新开页/地址栏直达都能让 tag 高亮始终与页面正文一致。
  const current: Mode = isMode(paramMode) ? paramMode : DEFAULT_MODE;

  const switchTo = (m: Mode) => {
    if (m === current) return;
    let query: URLSearchParams;
    let base: string;
    if (pathname === "/search") {
      // 搜索页切换模式：清空搜索条件（q/朝代/体裁/命中/页码），仅保留 mode
      query = new URLSearchParams();
      query.set("mode", m);
      base = pathname;
    } else {
      base = switchTarget(pathname);
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
