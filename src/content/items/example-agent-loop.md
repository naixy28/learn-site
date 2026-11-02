---
title: 【示例】ReAct：先想一步，再做一步
source_url: https://arxiv.org/abs/2210.03629
source_type: 论文
domain: Agent架构
value: 值得学
value_reason: 它把「想」和「做」拆开，方便对照自己的 agent 循环里缺的是观察、工具，还是停止条件。这是示例条目，用来演示价值判断怎么写。
status: 学习中
added: 2026-10-12
notion_url: https://www.notion.so/example-ryan-react-note
summary: 示例笔记。ReAct 让模型交替写出思考和动作，再用工具观察结果决定下一步，而不是一次生成最终答案。
---

> **这是示例条目，不是 Ryan 的真实笔记。** 用来把版式、目录和自测折叠跑通。真正的材料之后加到 `src/content/items/`，这篇可以删。

## 核心观点深度讲解

很多人把 agent 写成「一次调用，直接给答案」。问题一旦需要查资料、跑命令或读行情，模型就只能靠记忆编。ReAct 的做法很具体：每一轮先写一小段思考，再决定一个动作；动作的结果作为观察送回下一轮，直到写出最终答案，或者步数到了上限。

它和两种常见写法都不一样。

- 只写思维链：推理留在文本里，没有外部事实进来，错了也不知道。
- 只调工具：模型直接选函数，不解释为什么现在该查这个，失败了也不容易复盘。

ReAct 把这两件事放进同一个循环。思考负责缩小下一步，动作负责拿到新事实，观察负责把事实写回上下文。论文里的重点不是某个提示词模板，而是这个交替结构。

可以把它想成一个有上限的循环，而不是一次请求：

```ts
type Step = {
  thought: string;
  action: string;
  observation: string;
};

async function reactLoop(question: string, maxSteps = 6): Promise<string> {
  const trace: Step[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const decision = await model.next(question, trace);
    if (decision.finalAnswer) return decision.finalAnswer;

    const observation = await tools.run(decision.action);
    trace.push({
      thought: decision.thought,
      action: decision.action,
      observation,
    });
  }

  return model.summarize(question, trace);
}
```

三个设计选择比提示词措辞更要紧。

1. **步数上限。** 没有 `maxSteps`，工具失败时模型会一直重试。
2. **观察原样回写。** 不要让模型在调用前假装已经看到结果。
3. **最终答案单独标记。** 否则「我打算回答」和「这是答案」会混在同一段文本里。

## 与 Ryan 项目的结合点

如果现在的 agent 是一次生成就结束，先不要重写整个框架。只在主循环外面包一层最多 N 步的循环，每步强制留下 `thought`、`action`、`observation` 三行日志。

工具按领域接，不必一次接全：

- Agent 架构：先接只读工具，例如查文档、列文件。确认循环能停，再接会改状态的工具。
- 交易自动化：动作可以是拉行情或查持仓，观察必须带回时间戳。没有时间戳的数字不能拿来下判断。
- 内容创作：动作可以是检索旧稿或素材，观察写明摘了哪一段，避免最后文章对不上来源。

结合点要写到「改哪一段循环」，不要停在「这个想法不错」。这篇示例对应的改动就是：给主循环加上限，并把工具返回值原样写进下一步的上下文。

## 动手练习

1. 拿一段现有的 agent 日志，给每一行标上思考、动作或观察。标不出来的地方，就是循环还没拆开。
2. 把最大步数设成 4，故意让工具返回空字符串，看模型会不会把空结果说成「已经查到了」。
3. 写一个停止条件：出现最终答案，或连续两步观察相同，就停。把这个条件写成代码注释，放在循环旁边。

## 自测问题

先盖住答案，自己写一句，再展开。

### 每一轮模型至少要交出什么？

<details>
<summary>查看答案</summary>

一轮里要有思考和动作。如果它决定结束，动作就换成最终答案。思考说明这一步为什么这样做，动作才能被执行和复查。

</details>

### 为什么观察结果不能由模型事先写好？

<details>
<summary>查看答案</summary>

观察来自工具或环境，不是来自模型的猜测。事先写好就等于把未经验证的内容当成事实，后面的步骤会在这个错误上继续推。

</details>

### 什么时候应该停，而不是再调一次工具？

<details>
<summary>查看答案</summary>

已经能给出最终答案、步数到达上限，或者新的观察没有带来新事实。停下来并说明卡在哪里，比继续调用更有用。

</details>

## 复盘

这一节等学完再写。示例先留出结构。状态改成「已完成」时补上，并在 frontmatter 里填写 `completed`。

- 我原来的理解：
- 读完之后改了什么：
- 还没搞懂的：
- 下一步要改的代码或流程：

## 原文链接

- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
