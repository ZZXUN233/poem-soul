"use client";

import { useRouter } from "next/navigation";

/** 阅读页顶部「返回上一级」面包屑：走浏览器 history，覆盖搜索/书架/每日一首/相关推荐/作者页等所有入口 */
export default function ReaderBack() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="reader-back"
      onClick={() => router.back()}
    >
      <span aria-hidden="true">←</span> 返回
    </button>
  );
}
