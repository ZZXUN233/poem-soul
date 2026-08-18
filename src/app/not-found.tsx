import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty">
      <h1 style={{ fontSize: 22 }}>404 · 未找到该篇</h1>
      <p>这首诗词不存在或链接有误。</p>
      <p>
        <Link href="/" style={{ color: "var(--accent-soft)" }}>
          ← 返回书架
        </Link>
      </p>
    </div>
  );
}
