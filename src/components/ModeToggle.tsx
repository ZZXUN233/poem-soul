"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_MODE, isMode, storeMode, type Mode } from "@/lib/mode";

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

/** 导航栏模式开关：古诗词 / 现代诗 一键切换（URL ?mode= 驱动 + localStorage 记住默认） */
export default function ModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramMode = searchParams.get("mode");
  // 首次渲染与服务端一致（DEFAULT_MODE），客户端挂载后再从 localStorage 同步
  const [current, setCurrent] = useState<Mode>(
    isMode(paramMode) ? paramMode : DEFAULT_MODE
  );

  useEffect(() => {
    if (!isMode(paramMode)) {
      const stored = window.localStorage.getItem("peomsoul-mode");
      if (isMode(stored)) setCurrent(stored);
    }
  }, [paramMode]);

  const switchTo = (m: Mode) => {
    if (m === current) return;
    storeMode(m);
    setCurrent(m);
    const base = switchTarget(pathname, m);
    const query = new URLSearchParams(searchParams.toString());
    query.set("mode", m);
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
