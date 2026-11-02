---
title: DeepSeek Harness：Super-agent 架构设计（两级架构 / 事件驱动 / Watchdog）
source_url: https://x.com/DeepSeekHarness/status/2116857257245987236
source_type: 帖子
domain: Agent架构
value: 值得学
value_reason: 只负责分派的 Router、上下文隔离的 Worker、判断长任务有无实质进展的 Watchdog，直接对应多 agent 编排和长任务控制。
status: 待学
added: 2026-11-02
notion_url: https://app.notion.com/p/40cf3ac83f9e81a89519cb4ae6d2e0e9
summary: DeepSeek Harness 团队的 X 长文：多任务的瓶颈是人的注意力，用 Router/Worker 两级架构、事件驱动 Trigger、全双工交互、计算状态环境分离和 Watchdog 构建常驻的 Super-agent。
---

> 来源：DeepSeek Harness 团队（Yujia Qiao 实现与执笔）发布的 X 长文，2026-11-01 20:37（东京时间）。文章声明讨论的是架构思路，不是 DeepSeek Harness 现有功能介绍。原型代码：[https://github.com/deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)（非官方产品）。

## 核心观点深度讲解

### 0. 问题定义：瓶颈从模型能力转向人的注意力

单任务 agent 已经很少需要人盯，但主流设计仍以「单个会话」为工作单元，会话之间相互隔离。作者经验是一个人同时只能跟 3–5 个活跃会话。所以：单任务受模型能力限制，多任务受人类注意力限制。给单会话 agent 接 CLI/MCP 只能让它收消息，仍然是同步阻塞、上下文混杂、设备离线就停。

Super-agent 的四个特征：**Continuous**（在 IM/GitHub 任一处交互都像同一个 agent）、**Productive**（多任务并行、上一条没完就能接下一条）、**Proactive**（监听环境事件，值得处理才动）、**Persistent**（常驻在线、异常自愈）。单个 ReAct 循环做不到这四点，必须靠外围系统架构。

### 1. 两级架构：连续性 vs 吞吐的取舍

- 所有事件进一个会话：上下文最连续，但 ReAct 一步一步走，吞吐低，多任务细节互相污染。
- 每个事件一个新会话：吞吐最高，但缺全局上下文，多个会话各自回复用户很混乱。
- 解法：**Router 层**（长寿命，负责所有人类交互、全局协调与记忆，自己不执行任务，甚至可以没有 Bash 工具）+ **Worker 层**（上下文隔离，一任务一 Worker，满配工具，用最强模型，不直接对人说话，只向 Router 汇报）。
- 与 Agent Team 的区别：Team Lead 要拆解单个复杂任务、频繁协调，推理负担重；Router 只分派任务、在高层追踪任务关系，不拆解任务。作者经验：Router 的活比想象简单，轻量模型通常就够。
- **Router 为什么不成为瓶颈——批处理**：一次推理期间到达的事件排队，下一轮合并注入。Router 是「长输入短输出」，合并的 Trigger 在 Prefill 阶段并行计算，所以单次请求耗时增长远慢于批大小。实验：每分钟 1→40 个需决策事件，平均批大小 1.0→2.8，单请求 2.5s→3.9s，摊薄到每个决策 6.4s→1.6s。

### 2. 事件驱动（Trigger）

- **两段式过滤（Fast/Slow Path）**：先用确定性代码按来源、群组、白名单等快速准入（每个来源可设「只响应明确请求 / 作为候选 / 忽略」），只有需要语义判断的候选事件才交给 LLM。语义策略写成 prompt，人可随时用自然语言增删策略。
- **订阅与直通（Pass-through）**：同一 PR / IM 话题 / 邮件链的连续事件称为 Thread。Router 为 Thread 的首个事件创建 Worker 后，Worker 直接订阅该 Thread；后续事件由代码直送 Worker（Fast Path），Router 只处理无订阅者的新事件（Slow Path）。订阅是多对多：多个 Worker 订阅同一 Thread 时会同时收到事件，从而无需点对点通信就能发现并解决冲突。
- **Inline & Spill**：把上下文窗口当缓存。Inline = 把很快会用到的信息直接放进窗口，省工具往返；Spill = 超预算的内容留在窗口外，只留引用/摘要。按局部性渐进：先给对象 ID+摘要 → 再内联相关对象 ID、时空相邻内容（如前 50 字、回复链、相邻评论）→ 超长内容截断并留指针。
- **Chain of Recall**：Trigger、Thread、Worker Session 都有唯一 ID，注入时内联相邻对象 ID，形成引用图；每次召回的结果也遵循 Inline & Spill，带下一跳的摘要和 ID。模型可从当前事件逐跳回溯，例如 Thread → 相关 Worker → 另一个 code review Thread。
- **推测执行（Acting Ahead）**：根据环境信号提前在后台干活，用上就交付，没用就丢弃。例：收到会议邀请先查日历冲突并起草回复；内部群配置了「静默复现并修复」策略，确认问题且找到简单修复才发声，否则全程沉默。

### 3. 全双工多渠道交互

- 把耗时工具调用改为异步 start()/stop()：start() 立即返回 "Started"，完成后结果作为新事件送回会话；模型可 stop() 掉跑太久的命令。这样会话在后台任务运行时仍能接新指令（DeepSeek Harness 已实现该机制，默认未开启）。
- 渠道风格分治：IM 轻量、少打扰、只在需要决策/签核时通知，硬规则「每条回复不超过 100 词」；GitHub/邮件/文档等异步渠道输出结构化、高密度内容。

### 4. 计算、状态、环境三者分离

- 第一层：Agent Loop 计算无状态，跑在弹性云容器；会话等持久状态放数据库。本地设备休眠不影响 agent。
- 第二层：执行环境（含未提交改动、私有凭据、内网依赖、特定硬件）难以同步，所以留在原地，每个端点只跑一个无状态轻量 daemon 执行命令返回结果。支持 BYOM（自带机器），设备断续在线时，重新上线后云端自动开跑需要该设备的任务。作者指出 Anthropic 的「Decoupling the brain from the hands」思路相同，但对方侧重托管沙箱和客户 VPC。

### 5. Watchdog

很多异常不是崩溃，而是模型陷入无效循环或偏离目标。所以需要主系统之外的独立控制回路：一个由定时消息驱动的 Watchdog Session，既处理 API 错误、状态恢复失败等基础设施问题，也用模型判断每个 Worker 是否有实质进展、是否偏离目标；它本身是满配工具的 agent，维护者可以用自然语言问它为什么失败，或让它在运行中调整 prompt 和触发规则。

### 6. 实验（作者自称仅供参考：合成负载、简化环境）

每次约 300 条消息（约 20 条工作请求），编码工作用耗时工具模拟，每种设计跑 5 次：

| 设计 | 完成时间 p50/p95（分钟） | 每次运行 cache-read tokens |
| --- | --- | --- |
| Super-agent | 12.4/15.7 | 23.2M |
| 无 Pass-through | 12.6/15.5 | 31.8M |
| 单会话+Subagent 工具，中性 prompt | 20.4/29.5 | 6.1M |
| 单会话+Subagent 工具，委派优先 prompt | 13.8/29.0 | 10.8M |

关键解读：中性 prompt 下 5 次都没调 subagent；委派 prompt 下 5 次中 4 次委派，剩下一次模型判断活「小」就自己做，造成长尾。**单会话要靠 prompt 和模型临场判断决定是否委派，两级架构在系统层面消除了这个不确定性。** 代价是用更多 token 换更短更稳的完成时间。去掉 Pass-through 时间差不多，但 Router 决策多约 30%，token 多约 37%。

### 7. 开放问题

Router 何时分片、Worker 间何时直连；数月级长期记忆是主要瓶颈；没有会话后产品形态怎么设计；A2A 与上下文边界；安全隐私——云端 Agent Loop 一旦被入侵或被提示注入，所有接入的端点都可能被接管；凭据进入上下文就可能泄露，需要「用凭据但看不到凭据」的机制。

## 与 Ryan 项目的结合点

- **多 agent 编排**：这几乎就是一份「个人 agent 系统」的参考架构。你现在用多个 bot（研究 bot、学习 bot 等）分工，本质就是手工版 Worker；缺的是一个只分派、不执行的 Router 和 Thread 订阅机制。
- **长任务控制**：Watchdog 判断「有无实质进展/是否跑偏」以及异步 start/stop，正对应长任务卡死、跑偏的痛点。
- **小模型微调**：文中明确提出 Router 用轻量模型即可，并把「专门为 Router 工作训练模型（判断事件、批量分派、召回上下文）」列为方向——这是一个边界清晰、数据可从日志自动产出的小模型微调题目。
- **交易自动化**：行情、新闻、成交回报就是 Trigger 流；Fast Path 用确定性规则（价格阈值、来源白名单）过滤，Slow Path 才交给 LLM，推测执行可用来预先准备分析但不下单。注意文中的安全警告：凭据（交易所 API key）不能进模型上下文。
- **内容创作**：多渠道风格分治（IM 100 词上限 vs 文档长文）可直接迁移到不同平台的内容输出。

## 动手练习

1. **两段式事件过滤器**：选一个你真实的事件源（如 Telegram 群或 GitHub 通知），写一个 Fast Path（来源/白名单/关键词规则，三档：明确请求/候选/忽略）+ Slow Path（小模型判断是否需要行动）。统计一周内多少比例的事件在 Fast Path 被丢弃。
2. **最小 Router/Worker + Thread 订阅**：实现一个 Router（不给执行工具）把新 Thread 分派给 Worker，Worker 订阅 Thread 后后续消息由代码直送。复现文中的消融：对比「有/无直通」时 Router 的调用次数与 token。
3. **Watchdog + 异步工具**：把一个耗时工具改成 start()/stop() 异步接口，再写一个定时 Watchdog 读取 Worker 最近 N 步日志，用模型输出「有进展/在循环/跑偏」判断并在后两种情况下注入纠偏提示。

## 自测问题

### 1. 为什么「所有事件进一个会话」和「每个事件一个会话」都不行？两级架构分别从哪层拿到连续性和吞吐？

<details>
<summary>查看答案</summary>

单会话上下文最连续，但 ReAct 一步一步走，吞吐低，多任务细节互相污染；每事件一个会话吞吐最高，但缺全局上下文，多个会话各自回复用户很混乱。两级架构由长寿命的 Router 层负责人类交互、全局协调与记忆，提供连续性；由一任务一 Worker、上下文隔离的 Worker 层提供吞吐。

</details>

### 2. Router 单会话为什么在事件突发时反而摊薄成本更低？这个效应的上限由什么决定？

<details>
<summary>查看答案</summary>

靠批处理：一次推理期间到达的事件排队，下一轮合并注入。Router 是「长输入短输出」，合并的 Trigger 在 Prefill 阶段并行计算，单次请求耗时增长远慢于批大小（实验中每个决策从 6.4s 摊薄到 1.6s）。上限原文未给出明确结论；按原文机制推断，受单次请求耗时随批大小增长的速度限制，开放问题中也提到 Router 何时需要分片。

</details>

### 3. 订阅/直通机制省掉了什么？为什么实验里它没让任务更快却大幅省 token？

<details>
<summary>查看答案</summary>

省掉了 Router 对同一 Thread 后续事件的处理：Worker 订阅 Thread 后，后续事件由代码直送 Worker，Router 只处理无订阅者的新事件。完成时间主要由 Worker 干活决定，所以去掉直通时间差不多；但 Router 决策多约 30%，token 多约 37%。

</details>

### 4. Inline 与 Spill 各自解决什么浪费？Chain of Recall 如何靠 ID 实现多跳召回？

<details>
<summary>查看答案</summary>

Inline 把很快会用到的信息直接放进窗口，省掉工具往返；Spill 把超预算的内容留在窗口外，只留引用或摘要，避免占满窗口。Chain of Recall 给 Trigger、Thread、Worker Session 唯一 ID，注入时内联相邻对象 ID 形成引用图，召回结果也带下一跳的摘要和 ID，模型可从当前事件逐跳回溯。

</details>

### 5. 为什么单会话+Subagent 工具的完成时间不稳定？这说明「靠 prompt 约束行为」和「靠架构约束行为」有什么区别？

<details>
<summary>查看答案</summary>

是否委派要靠 prompt 和模型临场判断：中性 prompt 下 5 次都没调 subagent；委派优先 prompt 下仍有一次模型判断活「小」就自己做，造成长尾。靠 prompt 只能影响概率，两级架构在系统层面消除了这个不确定性，代价是更多 token。

</details>

## 原文链接

- X 原帖：[https://x.com/DeepSeekHarness/status/2116857257245987236](https://x.com/DeepSeekHarness/status/2116857257245987236)
- 原型代码：[https://github.com/deepseek-ai/dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype)
- 文中引用：[https://www.anthropic.com/research/managed-agents](https://www.anthropic.com/research/managed-agents)
