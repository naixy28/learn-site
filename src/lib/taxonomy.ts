export const SOURCE_TYPES = ['帖子', '文章', '论文', '视频', '其他'] as const;
export const DOMAINS = ['Agent架构', '模型微调', '交易自动化', '内容创作', '其他'] as const;
export const VALUES = ['值得学', '一般', '不值得'] as const;
export const STATUSES = ['待学', '学习中', '已完成', '跳过'] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];
export type Domain = (typeof DOMAINS)[number];
export type Value = (typeof VALUES)[number];
export type Status = (typeof STATUSES)[number];
