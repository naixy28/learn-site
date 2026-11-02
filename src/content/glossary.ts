/** 词义都来自现有笔记，不另加定义。frontmatter 的 terms 可以覆盖同名 id。 */
export type GlossaryTerm = {
  id: string;
  term: string;
  definition: string;
};

export const glossary: GlossaryTerm[] = [
  {
    id: 'agent-loop',
    term: 'agent loop',
    definition:
      '组装上下文，流式调用模型，有工具调用就执行并回填，否则结束。六家都是这个骨架。',
  },
  {
    id: 'fact-source',
    term: '事实源',
    definition: '状态以什么为准。笔记里列的是内存、JSONL、事件日志、数据库。',
  },
  {
    id: 'sequential',
    term: 'sequential',
    definition: '工具上的声明。一批里只要有一个工具这样声明，Pi 就把整批改成串行。没声明时默认并行。',
  },
  {
    id: 'length-stop',
    term: 'stopReason === "length"',
    definition: 'Pi 里输出因为长度停住。这时整批工具调用直接判失败，不执行可能被截断的参数。',
  },
  {
    id: 'interruptible',
    term: 'interruptible',
    definition:
      'oh my pi 的工具声明。用户插话只硬中断可中断工具；还没开始的可中断工具被跳过；不可中断的工作永不跳过。',
  },
  {
    id: 'loop-guard',
    term: 'ToolCallLoopGuard',
    definition:
      '检测到重复调用后注入纠偏提示。advisor 的内部循环要模型无视一次纠偏，才 abort。笔记里的「重复调用拦截」说成硬拦截，需要按这个改。',
  },
  {
    id: 'advisor',
    term: 'advisor',
    definition: 'oh my pi 的第二模型，逐轮审查。它的内部循环在模型无视一次纠偏时才 abort。',
  },
  {
    id: 'output-item-done',
    term: 'OutputItemDone',
    definition: 'Codex 流里出现一个完整工具调用的事件。一出现就立刻把这次调用作为 future 启动。',
  },
  {
    id: 'futures-ordered',
    term: 'FuturesOrdered',
    definition: 'Codex 用来保住工具 future 顺序的结构。流结束再 drain。',
  },
  {
    id: 'rwlock',
    term: 'RwLock',
    definition: 'Codex 的并发锁。支持并行的工具拿读锁，否则拿写锁独占。',
  },
  {
    id: 'turn',
    term: 'turn',
    definition: 'DeepSeek Harness 的外层。kick() 里是 while (await this.turn())。一次 turn 里有多个 step。',
  },
  {
    id: 'step',
    term: 'step',
    definition:
      'turn 里面的一步。和 attempt 分开后，重试不会重复认领用户输入，也不会重跑 pre-step 钩子。OpenCode 也按 step 推进。',
  },
  {
    id: 'attempt',
    term: 'attempt',
    definition: '一次模型请求。失败、重试、取消都落成 assistant/attempt 事件。重试只发生在这一层。',
  },
  {
    id: 'derive-messages',
    term: 'deriveMessages()',
    definition: '从 append-only 会话日志重建模型可见内容。DeepSeek Harness 要求所有模型可见内容都能这样重建。',
  },
  {
    id: 'turn-closers',
    term: 'interruptedTurnClosers',
    definition:
      'resume 时为中途崩溃的 turn 追加的补闭合事件。用来把日志补完整，不是去续跑已经执行到一半的工具。',
  },
  {
    id: 'stale-compactions',
    term: 'settleStaleCompactions',
    definition:
      'OpenCode 把进程死亡后仍标着 running 的压缩改成 interrupted。状态还在库里，会话可以恢复，未完成的工具不会自动接着跑。',
  },
  {
    id: 'max-steps',
    term: 'max-steps',
    definition: 'OpenCode 的步数上限。到达后禁用工具，强制模型写出总结和剩余任务。',
  },
  {
    id: 'worktree',
    term: 'worktree',
    definition: 'oh my pi 的 task 工具把子 agent 放到独立 worktree 里扇出，并返回经过 schema 校验的结构化结果。',
  },
  {
    id: 'super-agent',
    term: 'Super-agent',
    definition:
      '四个特征：Continuous，在 IM 或 GitHub 任一处交互都像同一个 agent；Productive，多任务并行，上一条没完就能接下一条；Proactive，监听环境事件，值得处理才动；Persistent，常驻在线，异常自愈。',
  },
  {
    id: 'router',
    term: 'Router',
    definition:
      '长寿命的一层。负责所有人类交互、全局协调和记忆。自己不执行任务，甚至可以没有 Bash 工具。只分派，不拆解任务。',
  },
  {
    id: 'worker',
    term: 'Worker',
    definition: '一任务一个，上下文和别的任务隔开。工具配满，用最强模型。不直接对人说话，只向 Router 汇报。',
  },
  {
    id: 'agent-team',
    term: 'Agent Team',
    definition:
      '和 Router 的差别：Team Lead 要拆解单个复杂任务、频繁协调，推理负担重。Router 只分派，在高层追踪任务关系，不拆解任务。',
  },
  {
    id: 'trigger',
    term: 'Trigger',
    definition: '驱动这套结构的事件。一次推理期间到达的事件会排队，下一轮合并注入 Router。',
  },
  {
    id: 'fast-path',
    term: 'Fast Path',
    definition:
      '用确定性代码按来源、群组、白名单做快速准入。每个来源可以设成只响应明确请求、作为候选，或忽略。',
  },
  {
    id: 'slow-path',
    term: 'Slow Path',
    definition: '只有需要语义判断的候选事件才交给 LLM。语义策略写成 prompt，人可以用自然语言增删。',
  },
  {
    id: 'thread',
    term: 'Thread',
    definition: '同一条 PR、同一个 IM 话题或同一条邮件链上的连续事件。',
  },
  {
    id: 'pass-through',
    term: 'Pass-through',
    definition:
      'Worker 订阅 Thread 之后，后续事件由代码直接送给 Worker。Router 只处理还没有订阅者的新事件。多个 Worker 可以订阅同一 Thread，同时收到事件。',
  },
  {
    id: 'inline',
    term: 'Inline',
    definition: '把很快会用到的信息直接放进上下文窗口，省掉一次工具往返。',
  },
  {
    id: 'spill',
    term: 'Spill',
    definition: '超出预算的内容留在窗口外面，窗口里只留引用或摘要。',
  },
  {
    id: 'chain-of-recall',
    term: 'Chain of Recall',
    definition:
      'Trigger、Thread、Worker Session 都有唯一 ID。注入时带上相邻对象的 ID，召回结果再带下一跳的摘要和 ID，模型可以逐跳回溯。',
  },
  {
    id: 'acting-ahead',
    term: 'Acting Ahead',
    definition: '根据环境信号提前在后台做事。用得上就交付，用不上就丢弃。',
  },
  {
    id: 'watchdog',
    term: 'Watchdog',
    definition:
      '主系统之外、由定时消息驱动的独立控制回路。既处理 API 错误和状态恢复失败，也判断每个 Worker 有没有实质进展、有没有偏离目标。它自己是满配工具的 agent。',
  },
  {
    id: 'byom',
    term: 'BYOM',
    definition:
      '自带机器。执行环境留在原地，每个端点跑一个无状态的轻量 daemon，执行命令并返回结果。设备重新上线后，云端自动开跑需要这台设备的任务。',
  },
];
