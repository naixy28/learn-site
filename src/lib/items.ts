import type { CollectionEntry } from 'astro:content';
import type { Status, Value } from './taxonomy';

export type Item = CollectionEntry<'items'>;

const valueRank: Record<Value, number> = {
  值得学: 0,
  一般: 1,
  不值得: 2,
};

export function isExample(item: Item): boolean {
  return item.id.startsWith('example-');
}

export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${year}年${month}月${day}日`;
}

export function byAddedDesc(a: Item, b: Item): number {
  return b.data.added.getTime() - a.data.added.getTime();
}

export function byAddedAsc(a: Item, b: Item): number {
  return a.data.added.getTime() - b.data.added.getTime();
}

export function inProgress(items: Item[]): Item[] {
  return items.filter((item) => item.data.status === '学习中').sort(byAddedDesc);
}

/** 待学条目：值得学优先，同一价值里加入更早的排前面。 */
export function recommended(items: Item[]): Item[] {
  return items
    .filter((item) => item.data.status === '待学')
    .sort((a, b) => {
      const byValue = valueRank[a.data.value] - valueRank[b.data.value];
      if (byValue !== 0) return byValue;
      return byAddedAsc(a, b);
    });
}

export function recentlyAdded(items: Item[], limit = 6): Item[] {
  return items.toSorted(byAddedDesc).slice(0, limit);
}

export function counts(items: Item[]): Record<Status | 'total' | 'active', number> {
  const byStatus = {
    待学: 0,
    学习中: 0,
    已完成: 0,
    跳过: 0,
  } satisfies Record<Status, number>;

  for (const item of items) {
    byStatus[item.data.status] += 1;
  }

  return {
    total: items.length,
    ...byStatus,
    active: items.length - byStatus.跳过,
  };
}
