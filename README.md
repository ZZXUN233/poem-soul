# 诗魂 · Poem Soul

> 行于诗卷，箸点平仄 —— 基于**离线语料**的古诗词索引、展示与阅读 Web 应用。

诗魂是 Android 应用「行箸（XingZhu）」的 Web 伴侣。复用其已清洗的离线语料，在网页上提供**每日一首、全文检索、诗词阅读**等基础功能；后续规划 AI 玩法（格律 / 平仄 / 韵脚赏析、智能问答）。

## 技术栈

- [Next.js 16](https://nextjs.org/)（App Router）+ React 19 + TypeScript
- 语料：**本地离线数据**（`public/data/`，由脚本从母工程生成），无第三方搜索服务、无外网依赖

## 数据来源

语料来自 Android 侧 `../app/src/main/assets/corpus/`（源自 [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)，MIT 协议，已做繁转简与清洗）。共 **76,253 首**、约 **540 万字**，覆盖：

| 诗卷 | 数量 |
| --- | --- |
| 全唐诗 | 43,099 |
| 宋词 | 21,042 |
| 元曲 | 10,906 |
| 五代词 | 543 |
| 诗经 | 305 |
| 清词（纳兰性德） | 257 |
| 楚辞 | 65 |
| 曹操集 | 26 |
| （+ 精选种子 10 首） | — |

## 快速开始

```bash
cd peom-soul
npm install
npm run dev            # 开发：http://localhost:3000
# 或生产：
npm run build && npm start
```

> `public/data/` 语料数据**已随仓库提交**，仓库自包含、clone 后即可运行（无需母工程语料）。
> 如语料有更新，可在 peom-soul/ 目录下运行 `npm run build:data` 重新生成（会读取 `../app/src/main/assets/corpus/*.json.gz`）。

## 功能

- 🎲 **每日一首**：首页从全诗库随机推一首（按日期定首稳定），可「重摇」换诗
- 🔍 **全文检索**：标题、作者、正文匹配，命中字段高亮 + 上下文片段，支持朝代 / 体裁过滤；结果可按「命中标题/作者/正文」tab 切换（URL 驱动 `/search?q=…&match=…`）
- 📖 **阅读**：`/poem/<id>` 展示单首诗词完整正文与元信息；近体诗（五/七言绝句、律诗）按对仗两列对齐展示

## 目录结构

```
peom-soul/
├── scripts/build-data.mjs   # 语料迁移 + 索引构建（node 内置 zlib，零依赖，可再生成）
├── public/data/             # 语料数据（已随仓库提交，自包含可运行）
│   ├── meta.json            # 全局概览 / 朝代 / 体裁
│   ├── poems/<set>.json     # 各集完整记录（阅读页 / 浏览）
│   └── index/search.json    # 全文搜索索引
└── src/
    ├── app/                 # App Router：layout / 首页 / search / poem/[id] / ai / api
    ├── lib/                 # corpus.ts（数据加载缓存） + search.ts（搜索核心）
    ├── components/          # PoemCard / FilterBar / SearchBar / Pagination / Bookshelf / SearchPage / PoemReader
    └── types.ts             # 数据模型（与 Android PoemSeed 对齐）
```

## 搜索实现

- 服务端 `GET /api/search`，内存加载 `search.json` 后线性子串扫描（76k 首 / 540 万字，Node 下毫秒级）
- 命中优先级：标题 > 作者 > 正文；关键词先做 HTML 转义再插入 `<mark>`，防 XSS
- 分页 + 朝代 / 体裁过滤，结果以 `snippet` 片段 + `<mark>` 高亮返回

## 后续规划（AI 玩法）

- 迁移 `../engine/` 格律引擎（诗韵新编平仄 / 韵脚判定）到 TS，在阅读页提供逐字平仄标注
- 同一韵部 / 词牌的推荐、基于语料的智能问答等

## 许可

语料：优开源 chinese-poetry（MIT）；本项目代码按母工程惯例。
