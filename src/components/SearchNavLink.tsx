"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DEFAULT_MODE, isMode, modeHref } from "@/lib/mode";

/** 导航栏「搜索」入口：保留当前语料模式，避免从现代诗跳到古诗词搜索页 */
export default function SearchNavLink() {
  const searchParams = useSearchParams();
  const paramMode = searchParams.get("mode");
  const mode = isMode(paramMode) ? paramMode : DEFAULT_MODE;
  return <Link href={modeHref("/search", mode)}>搜索</Link>;
}
