"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DEFAULT_MODE, isMode, modeHref } from "@/lib/mode";

/** 导航栏「抽卡」入口：保留当前语料模式，进入全屏抽卡页 */
export default function CardsNavLink() {
  const searchParams = useSearchParams();
  const paramMode = searchParams.get("mode");
  const mode = isMode(paramMode) ? paramMode : DEFAULT_MODE;
  return (
    <Link href={modeHref("/cards", mode)} className="nav-cards">
      <span aria-hidden="true">🎴</span>
      抽卡
    </Link>
  );
}
