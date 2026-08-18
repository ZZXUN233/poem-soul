export const metadata = {
  title: "诗魂 AI · Poem Soul",
};

/** 诗魂 AI —— 玩法占位页（后续接入格律引擎 / 智能问答） */
export default function AiPage() {
  return (
    <div className="reader" style={{ maxWidth: 680, textAlign: "left" }}>
      <h1 className="reader-title">诗魂 AI</h1>
      <p className="search-meta">🚧 玩法开发中，敬请期待</p>

      <div className="notice">
        <p>
          诗魂将基于现有的<strong>格律引擎</strong>（诗魂引擎，源自 Android
          侧 <code>engine/</code> 模块的「诗韵新编」平仄 / 韵脚判定逻辑）为你解锁更多阅读玩法：
        </p>
        <ul>
          <li>✍️ 逐字<strong>平仄</strong>标注（〇 平 / ● 仄 / ？待考）</li>
          <li>🔴 句末韵脚标注与《诗韵新编》韵部归属</li>
          <li>🔍 同一韵部、同一词牌的诗词推荐</li>
          <li>💬 基于诗词语料的智能问答与赏析</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          当前版本为占位入口，将在后续迭代中接入。
        </p>
      </div>
    </div>
  );
}
