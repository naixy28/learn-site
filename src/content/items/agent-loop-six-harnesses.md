---
title: 六家 Agent Harness 的 Agent Loop 源码精读
source_url: https://cursor.com/canvas/store-06ca8338-e99b-408a-bd34-c87c04403daf/644b94d8-e808-4a1a-9c7d-5af5e51170bb
source_type: 文章
domain: Agent架构
value: 值得学
value_reason: 对照源码比较六家在工具并发、中断、上下文压缩、重试和持久化恢复上的做法，最后的 8 条启示可直接当长任务内核的检查清单。
status: 待学
added: 2026-11-02
notion_url: https://app.notion.com/p/40cf3ac83f9e8130b2ece23107816a83
summary: 对比 Pi、oh my pi、Claude Code、Codex、DeepSeek Harness、OpenCode 的 agent loop 实现，每条结论标注已核实、未核实、推断或需修正。
---

> 来源：Ryan 的研究 bot 制作的 canvas，基于对小红书笔记「不同harness的agent loop是怎么做的」的逐家源码核对。源码快照 2026-10-28 至 10-29（东京时间）。原文每条结论都标了「已核实 / 未核实 / 推断 / 需修正」，本页沿用这些标签；Claude Code 闭源，其调度细节只能视为推断。

## 核心观点深度讲解

### 0. 共同骨架与真正的差异

六家都是「组装上下文 → 调用模型（流式）→ 有工具调用就执行并回填 → 否则结束」。差异在于四个问题放在哪一层：**谁决定继续**（循环、钩子还是插件）、**工具何时开跑**（流中还是流后）、**失败如何恢复**（重试、压缩、提权）、**状态的事实源是什么**（内存、JSONL、事件日志、数据库）。

### 1. Pi（pi-mono，e65b3b8）——求极简

双层 while：内层在「有工具调用或有 steering 消息」时继续，外层在要停时再拉一次 follow-up，有就塞回继续（已核实）。loop 只暴露 prepareNextTurn / prepareRequest / finishTurn 钩子，压缩、重试、模型路由挂在 AgentSession（已核实）。工具默认并行，任一工具声明 sequential 则整批串行。亮点：`stopReason === "length"` 时整批工具调用直接判失败，不执行可能被截断的参数。不内置子 agent 和 plan mode（README 原话，已核实）。取舍：可读、可嵌入；安全与编排全靠扩展。

### 2. oh my pi（b075692）——重纠偏

Pi 的 fork，loop 从 959 行涨到 4146 行，几乎都是纠偏和中断语义。工具可声明 `interruptible`：用户插话只硬中断可中断工具，未开始的可中断工具被跳过，非可中断工作永不跳过（已核实）。流内规则：正则命中即中止流、注入规则为 system reminder 并从原处重试。笔记说的「重复调用拦截」**需修正**：实际是 ToolCallLoopGuard 检测重复后注入纠偏提示，advisor 内部循环无视一次纠偏才 abort。另有 advisor 第二模型逐轮审查，以及 task 工具在独立 worktree 扇出子 agent、返回 schema 校验的结构化结果。

### 3. Claude Code（闭源）——重外壳

经典单层 ReAct（未核实，与 tool use 协议一致）。「读并行写串行」来自社区逆向（未核实）。已核实部分：权限模式（default / acceptEdits / plan / bypassPermissions）、hooks（PreToolUse、PostToolUse、Stop、SubagentStop、PreCompact）、子 agent、/compact 与自动压缩、--resume。取舍：循环可预期，扩展点放在 hooks，适合企业治理。

### 4. Codex（8fdf647）——重沙箱、低延迟

run_turn 以「一次采样请求」为单位循环，依 needs_follow_up 决定是否继续（已核实）。关键：**流里一出现完整工具调用（OutputItemDone）就立即作为 future 启动**，放入 FuturesOrdered 保序，流结束再 drain（已核实）。并发靠 RwLock：支持并行的工具拿读锁，否则拿写锁独占。orchestrator 负责审批、沙箱选择和「沙箱拒绝后提权重试（需重新审批）」。取舍：延迟最低、安全模型最完整；流中断时已启动的工具需额外收尾。

### 5. DeepSeek Harness（f3803c96）——重日志

turn / step / attempt 三层（已核实）：kick() 里 `while (await this.turn())`，turn 内多个 step，每次模型请求是一个 attempt，失败/重试/取消都落 assistant/attempt 事件。**所有模型可见内容都必须能从 append-only 会话日志重建**（deriveMessages()）。策略全靠插件 waterfall 钩子，压缩也是插件（先剪工具结果再摘要）。崩溃恢复：resume 时为中途崩溃的 turn 追加 interruptedTurnClosers 补闭合事件。默认无步数预算（第三方分析）。取舍：可重放、可 fork、遥测和 UI 共用一个事实源；代价是插件注册顺序成为隐式控制流。

（与上一条学习材料 Super-agent 文章是同一团队，可对照阅读：那篇讲外围多会话架构，这里是单会话内核。）

### 6. OpenCode（f023f7c）——重持久化

Effect + SQLite：外层按 step 推进，每个 step 内有 attempt 重试循环（OpenCode 也有 step/attempt 分层，并非 DeepSeek 独有）。step 开始前异步拍 Git 快照，结束再拍一次用于 diff/revert。笔记的「崩溃后能接着跑」**需修正**：代码看到的是 settleStaleCompactions 把进程死亡留下的 running 压缩标为 interrupted——状态不丢、可从库恢复会话，不是自动续跑未完成工具。max-steps 达上限后禁用工具，强制模型输出总结和剩余任务。

### 7. 横向对比要点

| 维度 | Pi | oh my pi | Claude Code | Codex | DeepSeek | OpenCode |
| --- | --- | --- | --- | --- | --- | --- |
| 循环层级 | 双层 while | 双层+纠偏 | 单层（推断） | turn→采样 | turn→step→attempt | step→attempt |
| 工具开跑 | 流后 | 流后 | 流后（推断） | 流中即启动 | 流后整批 | attempt 内 |
| 事实源 | JSONL | 会话+stats DB | JSONL（推断） | rollout 文件 | append-only 事件日志 | SQLite+Git 快照 |

### 8. 对长任务多 agent 编排的 8 条启示（原文）

1. 事实源用 append-only 事件日志，模型请求一律从日志派生，resume/fork/审计/回放共用一套逻辑。
2. 区分 step 与 attempt：重试不重复认领用户输入、不重跑 pre-step 钩子。
3. 崩溃修复写成显式「补闭合事件」，不要假设能续跑到一半的工具调用。
4. 工具声明副作用属性（并行安全、可中断、可提权），编排器据此调度。
5. 长任务加硬预算（OpenCode max-steps 强制总结）。
6. 纠偏用注入而非硬拦截，必要时再 abort。
7. 截断的工具调用整批判失败。
8. 子 agent 隔离到独立 worktree 并返回 schema 化结果。

## 与 Ryan 项目的结合点

- **长任务控制**：启示 1/3/5 直接构成一个可靠长任务内核的检查清单：事件日志 + 补闭合 + 步数预算。
- **多 agent 编排**：启示 4/8（工具副作用声明、worktree 隔离+结构化返回）是编排器调度的基础，可与 Super-agent 的 Router/Worker 组合：Super-agent 管会话之间，这六家管会话之内。
- **交易自动化**：下单类工具应声明为不可中断、不可并行（类似 Codex 写锁），行情查询类可并行；「截断参数整批判失败」对下单参数尤其重要。
- **内容创作**：这份「笔记说法 vs 源码核对」本身就是一个高质量技术内容选题模板。

## 动手练习

1. **最小 turn/step/attempt 内核**：写一个 ~200 行的 loop，所有事件写 append-only JSONL，模型请求只从日志 derive；人为在工具执行中 kill 进程，实现 resume 时补「interrupted」闭合事件。
2. **工具副作用声明 + 调度器**：给工具加 `parallelSafe` / `interruptible` 属性，用读写锁调度；验证插话只中断可中断工具。
3. **源码亲自核对一处「需修正」**：clone oh-my-pi 或 opencode，找到 ToolCallLoopGuard 或 settleStaleCompactions，自己确认 canvas 的结论，并对一处「未核实」项尝试找证据。

## 自测问题

### 1. 六家的共同骨架是什么？差异集中在哪四个问题？

<details>
<summary>查看答案</summary>

共同骨架是「组装上下文 → 调用模型（流式）→ 有工具调用就执行并回填 → 否则结束」。差异集中在：谁决定继续（循环、钩子还是插件）、工具何时开跑（流中还是流后）、失败如何恢复（重试、压缩、提权）、状态的事实源是什么（内存、JSONL、事件日志、数据库）。

</details>

### 2. Codex 为什么能比其他家延迟更低？流中断时会带来什么额外问题？

<details>
<summary>查看答案</summary>

流里一出现完整工具调用（OutputItemDone）就立即作为 future 启动，放入 FuturesOrdered 保序，流结束再 drain，不必等整个流结束才开跑工具。代价是流中断时，已启动的工具需要额外收尾。

</details>

### 3. step 与 attempt 分开解决了什么重复副作用问题？

<details>
<summary>查看答案</summary>

重试只发生在 attempt 层，不会重复认领用户输入，也不会重跑 pre-step 钩子。

</details>

### 4. 「崩溃后自动续跑」和「状态落库可恢复」有何本质区别？为什么推荐补闭合事件？

<details>
<summary>查看答案</summary>

状态落库可恢复是指状态不丢、可从库恢复会话（如 OpenCode 把 running 压缩标为 interrupted），并不会自动续跑未完成的工具。推荐把崩溃修复写成显式的「补闭合事件」（如 DeepSeek Harness 的 interruptedTurnClosers），而不是假设能续跑到一半的工具调用，这样日志保持完整，可从日志重建。

</details>

### 5. 纠偏为什么倾向于「注入提示」而不是「硬拦截」？

<details>
<summary>查看答案</summary>

原文启示是「纠偏用注入而非硬拦截，必要时再 abort」：如 oh my pi 的 ToolCallLoopGuard 检测到重复后注入纠偏提示，模型无视一次纠偏才 abort，先给模型自行修正的机会。

</details>

## 原文链接

- Canvas：[https://cursor.com/canvas/store-06ca8338-e99b-408a-bd34-c87c04403daf/644b94d8-e808-4a1a-9c7d-5af5e51170bb](https://cursor.com/canvas/store-06ca8338-e99b-408a-bd34-c87c04403daf/644b94d8-e808-4a1a-9c7d-5af5e51170bb)
- 源头：小红书笔记「不同harness的agent loop是怎么做的」（canvas 未给出链接）
- 源码：[https://github.com/badlogic/pi-mono](https://github.com/badlogic/pi-mono) ・ [https://github.com/can1357/oh-my-pi](https://github.com/can1357/oh-my-pi) ・ [https://github.com/openai/codex](https://github.com/openai/codex) ・ [https://github.com/deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) ・ [https://github.com/sst/opencode](https://github.com/sst/opencode) ・ [https://code.claude.com/docs](https://code.claude.com/docs)
