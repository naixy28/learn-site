# Ryan 的学习笔记

Ryan 的公开学习站，地址是 [https://learn.technokong.xyz](https://learn.technokong.xyz)。

静态站点用 Astro 内容集合生成，由名为 `learn-site` 的 Cloudflare Worker 通过静态资源托管。只绑定子域名 `learn.technokong.xyz`（zone `technokong.xyz`），不会改动其他 Worker，也不会动根域名。

界面是中文。

## 本地开发

```bash
npm install
npm run dev
```

`npm run build` 会校验 frontmatter 并输出到 `dist/`。

## 新增一条学习笔记

每条材料是一个文件：

```text
src/content/items/<slug>.md
```

也支持 `.mdx`。`<slug>` 用小写英文和连字符，不要建子目录。文件名就是网址：`src/content/items/react-loop.md` 对应 `/items/react-loop/`。

以 `example-` 开头的文件会显示「示例」标记。仓库里的 `example-agent-loop.md` 只是版式样例，真正的笔记加上之后可以删掉。

### Frontmatter

```yaml
---
title: 笔记标题
source_url: https://example.com/source
source_type: 文章          # 帖子 / 文章 / 论文 / 视频 / 其他
domain: Agent架构          # Agent架构 / 模型微调 / 交易自动化 / 内容创作 / 其他
value: 值得学              # 值得学 / 一般 / 不值得
value_reason: 为什么给这个价值，写一句具体的。
status: 待学               # 待学 / 学习中 / 已完成 / 跳过
added: 2026-11-02          # 加入日期，YYYY-MM-DD
completed: 2026-11-20      # 可选。学完再写
notion_url: https://www.notion.so/your-page  # 可选。没有就删掉这一行，不要留空字符串
summary: 一两句摘要，首页和列表用这段。
---
```

构建时会按这个结构校验。枚举写错、日期无法解析、链接不是 URL，`npm run build` 会失败。

### 正文结构

按这个顺序写。前四节和最后的原文链接每次都写；复盘等学完再补。

1. **核心观点深度讲解** — 用自己的话讲清楚，不要只贴摘要。
2. **与 Ryan 项目的结合点** — 写到会改哪一段流程或代码。
3. **动手练习** — 能在自己的项目里做的小步骤。
4. **自测问题** — 先提问，答案放进可折叠的 `<details>`。
5. **复盘** — 可选。学完、状态改为「已完成」时再写，并补上 `completed`。
6. **原文链接** — 指向 `source_url`。

自测答案这样写：

```markdown
### 这里写问题

<details>
<summary>查看答案</summary>

这里写答案。

</details>
```

加完后运行 `npm run build`。首页会把「学习中」放在正在学，「待学」按「值得学」优先、同一档更早加入的靠前，最近加入按日期从新到旧。`/items/` 可以按状态、领域、价值和类型筛选，并按加入日期排序。

## 部署

还没有 Cloudflare 登录时不要部署。配置在 `wrangler.jsonc`：Worker 名是 `learn-site`，静态资源目录是 `./dist`，自定义域名只有 `learn.technokong.xyz`。

### 本机：`npm run deploy`

在仓库根目录，已登录 Wrangler 的前提下：

```bash
npm run deploy
```

这条命令会先 `npm run build`，再执行 `wrangler deploy`。它只发布 `learn-site`，并为本子域名创建自定义域名记录。不要给 `technokong.xyz` 根域名加 route。

### Cloudflare Workers Builds（Git）

把这个仓库接到 Workers Builds 后，推送到生产分支会自动构建并部署。建议设置：

| 项 | 值 |
| --- | --- |
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| 部署命令 | `npx wrangler deploy` |

部署命令用仓库里的 Wrangler 版本。不要把部署命令设成 `npm run deploy`，除非构建命令留空，否则会构建两次。

文档：[Astro on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)、[自定义域名](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)、[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)。
