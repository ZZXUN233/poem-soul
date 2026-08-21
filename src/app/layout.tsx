import type { Metadata } from "next";
import { Suspense } from "react";
import SiteChrome from "@/components/SiteChrome";
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
        <Suspense>
          <SiteChrome>{children}</SiteChrome>
        </Suspense>
      </body>
    </html>
  );
}
