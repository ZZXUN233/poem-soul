import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "诗魂 · Poem Soul",
  description:
    "基于离线语料的古诗词索引、展示与阅读 Web 应用。内置诗经、楚辞、全唐诗、宋词、元曲等 7.6 万余首公版诗词。",
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
              <Link href="/">书架</Link>
              <Link href="/search">搜索</Link>
            </nav>
          </div>
        </header>
        <main className="container site-main">{children}</main>
        <footer className="site-footer">
          <div className="container">
            语料来自{" "}
            <a
              href="https://github.com/chinese-poetry/chinese-poetry"
              target="_blank"
              rel="noopener noreferrer"
            >
              chinese-poetry
            </a>
            （MIT），本地离线 · 诗魂 Poem Soul
          </div>
        </footer>
      </body>
    </html>
  );
}
