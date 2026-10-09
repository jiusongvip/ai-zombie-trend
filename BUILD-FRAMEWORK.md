# ai zombie trend — 建站构建框架（待确认）

> 核心关键词：**ai zombie trend** ｜ 参考站：aizombie.video、aizombie.net/zh
> 收款实现参考：`shipany-tanstack`（仅收款/积分/订单链路，不参考其前端样式）

---

## 阶段一：关键词竞争快照（已核实）

- **新词、竞争极低**：搜索结果里排名靠前的都是 2026 年新建的小站（zombieaivideo.com、zombietrendai.org）和 TikTok/Instagram 病毒内容，大站（media.io、pollo.ai、topmediai）只覆盖了相邻词 `ai zombie video generator` / `ai zombie filter`。
- **搜索意图**：几乎全是「transactional」——用户看到病毒视频后想找工具复刻。前 10 名混有工具页 + 教程页，**工具页排名占优**。
- **季节性**：Halloween（10 月底）前是流量峰值窗口，当前正值上升期，适合快速上线。
- 建议上线前人工复核：Google Trends 12 个月曲线 + `allintitle:"ai zombie trend"` 结果数（KGR）。

## 阶段二：产品定位与网站结构

**产品**：上传 2 张照片 → 生成 15 秒带配乐的 AI 丧尸视频（丧尸爱情故事/宠物版/朋友版）。一次性积分包付费（参考站 $6.90/100 credits 起），生成失败自动退还。

**结构决策（2026-10-09）：单页营销站。** 所有营销/转化内容（hero、generator 上传入口、分镜、示例墙、3 步、定价、FAQ、CTA）全部并入首页 `/`，导航用页内锚点（`/#generator`、`/#explore`）。仅保留 `/pricing`（交易页）、`/studio`+`/studio/library`（生成/收款闭环）、`/settings`、`/blog`、`(auth)`、legal。`/generator`、`/examples`、`/couple`、`/pet` 独立路由已删除。上线后如需打长尾词，可再逐批新增内页（横向拓展）。

| 页面 | URL | 目标关键词 | 类型 |
|---|---|---|---|
| 首页（单页） | `/` | ai zombie trend / ai zombie video / generator / examples / couple / pet / faq | 营销+转化（打核心词及长尾） |
| 定价 | `/pricing` | ai zombie video pricing | 交易页 |
| 生成器（应用） | `/studio` `/studio/library` | —（登录后工具+历史） | 应用页 |
| 博客 | `/blog/` | halloween ai trends / zombie trend TikTok | 内容资讯（横向拓展位） |

**横向拓展方向**（上线后逐批加内页）：`ai zombie filter`、`zombie trend photo`、`halloween couple video ai`、`ai zombie song video`、多语言站点（参考 aizombie.net 的 /zh 策略，可后置）。

## 阶段三：核心页面 SEO 方案

### 首页 `/`
- Title: `AI Zombie Trend — Turn 2 Photos into a Zombie Love Video`
- Meta: 50–160 字符按页型设计；首页写清「2 photos → 15s scored MP4, no prompt, no editing, credits from $6.90」
- H1: `The AI Zombie Trend, Made From Your Photos`
- Schema: `WebApplication` + `FAQPage` + `Organization`
- 模块顺序：Hero（示例视频自动播）→ 生成器入口 → 分镜说明（The cabin / The memory 式 shot list）→ 示例墙 → 3 步教程 → 定价积分包 → FAQ
- 内链：→ /generator /examples /pricing /blog

### 生成器 `/generator`
- Title: `AI Zombie Video Generator — Two Photos, One Film`
- Schema: `WebApplication`（offers = 积分包）
- 模块：上传 2 张照片 → 选风格（爱情故事/宠物/朋友）→  checkout 扣积分 → 异步渲染（可关标签页）→ `/library` 收结果

### 定价 `/pricing`
- Title: `Pricing — One-Time Credit Packs for Zombie Videos`
- 积分包卡片（3 档），无订阅；FAQ 覆盖退款/隐私/水印

## 阶段四：收款链路复用（来自 shipany-tanstack 的最小移植集）

数据流：点击积分包 → `POST /api/payment/checkout`（登录+限流+服务端价格目录）→ 创建 `order(created)` → 重定向 Stripe Checkout → webhook `notify/stripe` 验签 → 原子事务：order=paid + **credits grant**（失败可撤销）→ 回跳 `/callback` 兜底（localhost 无 webhook 时轮询 session）。

移植文件清单：

| 作用 | shipany 来源 |
|---|---|
| Provider 抽象 + Stripe | `src/core/payment/{types,index,stripe}.ts` |
| checkout/webhook/回调服务 | `src/modules/payment/service.ts` |
| API 路由 3 个 | `src/routes/api/payment/{checkout,callback,notify/$provider}.ts` |
| 表：order / subscription / credit | `src/config/db/schema.ts` 对应段 |
| 服务端价格目录 | `src/config/pricing.ts` |
| 积分发放/消费 | `src/modules/credits/service.ts` |
| 用户登录 | `src/core/auth`（better-auth）或简化为邮箱+密码 |
| 工具 | `src/lib/{hash,resp,rate-limit,cookie}` |

AI 生成侧同样可复用：`src/config/video-models.ts` + `src/modules/video/service.ts`（积分预扣 → 调 Fal/Replicate → 轮询 `/api/video/tasks/$id` → 结果入 R2），这正是参考站「2 张照片出 15s 视频」的同构实现。

## 技术路线（二选一，待决策）

| | 路线 A：fork shipany-tanstack（推荐） | 路线 B：Astro 静态站 + 轻收款 |
|---|---|---|
| 做法 | 复制模板到新目录，`blocks`/路由全部重写为 zombie 主题，前端按 aizombie.video 的语言重新设计（深色、电影感） | 纯 Astro（与你其它关键词站同构，Cloudflare Pages）+ Stripe Payment Link/托管结账，生成器跳外部或做简化版 |
| 收款 | 完整复用（验签、积分、订单、退款、admin 面板配 key） | 只到「收钱发货」级别，无积分账本 |
| 生成器 | 站内闭环：上传→付费→异步生成→库页取片（必须有后端） | 站内无法完整闭环 |
| 部署 | Cloudflare Workers 免费档 + D1（$0/月） | Cloudflare Pages（$0/月） |
| 成本 | 每次改动要部署 Worker；含登录/DB，复杂度高 | 极轻，git push 即部署 |

**我的判断**：这个关键词的变现核心是「站内生成器 + 积分扣费」，参考站都是闭环工具站，路线 A 与需求同构；路线 B 只能做「内容站 + 外链跳转」的半截方案。若你只想要流量站带联盟/单页收款，B 更快。

## 新目录骨架（路线 A，待构建）

```
ai-zombie-trend/
├── src/
│   ├── core/            # 复用：payment/ auth/ db/ storage/ ai/
│   ├── modules/         # 复用：payment/ credits/ video/ config/
│   ├── config/          # pricing.ts（积分包目录）、video-models.ts（丧尸风格）
│   ├── blocks/          # 全部重写：hero / shot-list / examples-wall / how-it-works / faq / pricing / header / footer
│   ├── components/      # 保留 primitives，新增 generator（上传+进度）
│   ├── routes/          # index generator examples couple pet pricing library blog/(...) api/payment/(...)
│   └── messages/        # en 先行，zh 后置
├── .env.example         # DATABASE_URL、AUTH_SECRET、STRIPE_*（key 后续走 admin/settings）
└── wrangler.jsonc       # D1 免费档部署
```

## 决策状态（2026-10-08）

- [x] 技术路线：**A — fork shipany-tanstack**，收款/积分/订单/视频链路完整复用；前端 blocks 全重写（深色电影风），不参考模板样式
- [x] 域名：未注册，先 localhost 构建
- [x] 骨架已就位：源码拷贝（排除 node_modules/.git/data/.output/paraglide/.env 密钥）、package 更名 `ai-zombie-trend`、独立 `AUTH_SECRET`/`CONFIG_ENCRYPTION_KEY`
- [x] SQLite 本地库已建（`data/local.db`），RBAC 已初始化，管理员 `admin@shipany.local`（密码见会话记录）
- [x] 骨架构建验证通过（`pnpm build` ✓；`/`、`/pricing`、`/zh` 均 200，`/api/payment/checkout` 路由响应且鉴权守卫生效）
  - 修复 1：`package.json` 增加 `pnpm.overrides` 将 `@noble/ciphers` 锁 2.1.1（hoisted 安装误把 1.3.0 顶层化导致 better-auth 构建失败）
  - 修复 2：postinstall 的 `mkdir -p` 改为跨平台 node 写法
- [ ] Google Trends 曲线人工复核 + allintitle KGR
- [x] 正式页面构建：首页重组 + `/generator`、`/examples`、`/couple`、`/pet` 路由 + blocks 全重写（深色电影风），`pnpm build` ✓，浏览器冒烟通过（首页/generator/couple 结构、guest 门控跳 sign-up、zh 双语均正常）
- [x] 单页化收敛（2026-10-09，用户决策「最好是单页」）：Generator block 并入首页，四个营销路由删除，header/footer/hero/cta 链接改页内锚点，`/generator` 等现返回 404；`pnpm build` ✓，浏览器复验首页含生成器区、无 console 错误、zh 正常

## 交付 checklist

- [x] 搜索前 10 竞争分析
- [ ] Google Trends 曲线人工复核 + allintitle KGR
- [ ] 域名选择（建议含关键词：如 `ai-zombie-trend.com` / `zombietrend.video` 类）
- [x] 技术路线决策（A — fork shipany-tanstack）
- [x] 脚手架搭建 + 收款链路复用（积分包目录改写；Stripe 测试模式待配密钥）
- [x] 前端页面构建（深色电影风，独立于 shipany 样式）
- [ ] Fal/Replicate 丧尸视频模型接入（后台 Settings 配密钥即可）
- [ ] 上线 + GSC 提交 sitemap

