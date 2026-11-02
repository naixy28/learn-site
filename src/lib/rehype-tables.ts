type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/** 宽表可以横向滚动，键盘能把焦点放进滚动区域。 */
export function rehypeWrapTables() {
  return (tree: HastNode) => {
    const hits: Array<{ parent: HastNode; index: number }> = [];
    const walk = (node: HastNode) => {
      node.children?.forEach((child, index) => {
        if (child.type === 'element' && child.tagName === 'table' && node.tagName !== 'div') {
          hits.push({ parent: node, index });
        } else {
          walk(child);
        }
      });
    };
    walk(tree);
    for (const { parent, index } of hits.reverse()) {
      const table = parent.children?.[index];
      if (!table || !parent.children) continue;
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['table-scroll'],
          tabIndex: 0,
          role: 'region',
          ariaLabel: '可横向滚动的表',
        },
        children: [table],
      };
    }
  };
}
