import { glossary, type GlossaryTerm } from '../content/glossary';

type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
};

type VFileLike = {
  path?: string;
  data?: { astro?: { frontmatter?: { terms?: GlossaryTerm[] } } };
};

const pattern = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function termsFor(file: VFileLike): Map<string, GlossaryTerm> {
  const map = new Map(glossary.map((term) => [term.id, term]));
  const extra = file.data?.astro?.frontmatter?.terms;
  if (!Array.isArray(extra)) return map;
  for (const term of extra) {
    if (!term || typeof term.id !== 'string') continue;
    map.set(term.id, term);
  }
  return map;
}

function renderTerm(id: string, label: string, definition: string, index: number): string {
  const tipId = `term-${id}-${index}`;
  return (
    `<span class="term">` +
    `<button type="button" class="term-btn" aria-expanded="false" aria-controls="${tipId}">${escapeHtml(label)}</button>` +
    `<span id="${tipId}" class="term-note" role="note" hidden>${escapeHtml(definition)}</span>` +
    `</span>`
  );
}

function skip(parent: MdastNode | null): boolean {
  if (!parent) return true;
  return parent.type === 'code' || parent.type === 'inlineCode' || parent.type === 'link' || parent.type === 'linkReference' || parent.type === 'html';
}

/** 把 [[id]] / [[id|显示]] 换成可聚焦的词义。未知 id 让构建失败。 */
export function remarkGlossary() {
  return (tree: MdastNode, file: VFileLike) => {
    const terms = termsFor(file);
    let count = 0;

    const walk = (node: MdastNode, parent: MdastNode | null) => {
      if (!node.children) return;
      for (let index = 0; index < node.children.length; index += 1) {
        const child = node.children[index];
        if (child.type === 'text' && child.value?.includes('[[') && !skip(parent)) {
          const value = child.value;
          const next: MdastNode[] = [];
          let last = 0;
          for (const match of value.matchAll(pattern)) {
            const start = match.index ?? 0;
            const id = match[1];
            const term = terms.get(id);
            if (!term) {
              throw new Error(`词表里没有 [[${id}]]（${file.path ?? '未知文件'}）`);
            }
            if (start > last) next.push({ type: 'text', value: value.slice(last, start) });
            count += 1;
            next.push({
              type: 'html',
              value: renderTerm(id, match[2] || term.term, term.definition, count),
            });
            last = start + match[0].length;
          }
          if (next.length === 0) {
            walk(child, node);
            continue;
          }
          if (last < value.length) next.push({ type: 'text', value: value.slice(last) });
          node.children.splice(index, 1, ...next);
          index += next.length - 1;
          continue;
        }
        walk(child, node);
      }
    };

    walk(tree, null);
  };
}
