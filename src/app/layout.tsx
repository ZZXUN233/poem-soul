import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import ModeToggle from "@/components/ModeToggle";
import SearchNavLink from "@/components/SearchNavLink";
import "./globals.css";

export const metadata: Metadata = {
  title: "诗魂 · Poem Soul",
  description:
    "基于离线语料的古诗词与现代诗索引、展示与阅读 Web 应用。内置全唐诗、宋词、元曲等古诗词及现代诗语料，本地离线。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark">詩</span>
              <span className="brand-name">
                诗魂 <span className="brand-sub">Poem Soul</span>
              </span>
            </Link>
            <nav className="header-nav">
              <Suspense>
                <ModeToggle />
              </Suspense>
              <Suspense>
                <SearchNavLink />
              </Suspense>
            </nav>
          </div>
        </header>
        <main className="container site-main">{children}</main>
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
      </body>
    </html>
  );
}
