"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ModeToggle from "./ModeToggle";
import SearchNavLink from "./SearchNavLink";
import CardsNavLink from "./CardsNavLink";

/**
 * 站点外层 chrome（header + footer + main 包裹）。
 * 依赖 usePathname 区分「沉浸式路由」（/cards 全屏抽卡）：
 * 抽卡页隐藏全局 header/footer 以获得真正的全屏阅读体验，main 始终保留。
 */
export default function SiteChrome({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const immersive = pathname.startsWith("/cards");

  return (
    <>
      {!immersive && (
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark">詩</span>
              <span className="brand-name">
                诗魂 <span className="brand-sub">Poem Soul</span>
              </span>
            </Link>
            <nav className="header-nav">
              <ModeToggle />
              <SearchNavLink />
              <CardsNavLink />
            </nav>
          </div>
        </header>
      )}

      <main className="site-main">{children}</main>

      {!immersive && (
        <footer className="site-footer">
          <div className="container">
            古诗词语料来自{" "}
            <a
              href="https://github.com/chinese-poetry/chinese-poetry"
              target="_blank"
              rel="noopener noreferrer"
            >
              chinese-poetry
            </a>
            ，现代诗语料来自{" "}
            <a
              href="https://github.com/sheepzh/poetry"
              target="_blank"
              rel="noopener noreferrer"
            >
              sheepzh/poetry
            </a>
            ，均以开源/MIT 协议本地离线 · 诗魂 Poem Soul
          </div>
        </footer>
      )}
    </>
  );
}
