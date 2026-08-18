"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_MODE, isMode, modeHref, storeMode, type Mode } from "@/lib/mode";

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "classic", label: "古诗词" },
  { value: "modern", label: "现代诗" },
];

/** 导航栏模式开关：古诗词 / 现代诗 一键切换（URL ?mode= 驱动 + localStorage 记住默认） */
export default function ModeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 当前 URL 里的 mode；无则取本地存储默认
  const paramMode = searchParams.get("mode");
  let current: Mode = isMode(paramMode) ? paramMode : DEFAULT_MODE;
  if (!isMode(paramMode) && typeof window !== "undefined") {
    const stored = window.localStorage.getItem("peomsoul-mode");
    if (isMode(stored)) current = stored;
  }

  const switchTo = (m: Mode) => {
    if (m === current) return;
    storeMode(m);
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    router.push(modeHref(path, m));
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
