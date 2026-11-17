/**
 * 目录浏览器。正文里写一个 [data-explorer] 块：
 * - [data-node="id"] 按钮选中一项，[data-panel="id"] 是对应的面板；
 * - [data-goto="id"] 跳到另一项；[data-explorer-filter] 按名字筛选。
 * 没有脚本时所有面板依次展开，内容照样能读。
 */
function initExplorer(root: HTMLElement) {
  const nodes = [...root.querySelectorAll<HTMLButtonElement>('[data-node]')];
  const panels = new Map(
    [...root.querySelectorAll<HTMLElement>('[data-panel]')].map((panel) => [panel.dataset.panel ?? '', panel]),
  );
  const filter = root.querySelector<HTMLInputElement>('[data-explorer-filter]');
  const count = root.querySelector<HTMLElement>('[data-explorer-count]');
  if (nodes.length === 0 || panels.size === 0) return;
  root.classList.add('is-live');

  const select = (id: string, focus: boolean) => {
    if (!panels.has(id)) return;
    for (const node of nodes) node.setAttribute('aria-pressed', String(node.dataset.node === id));
    for (const [key, panel] of panels) panel.hidden = key !== id;
    const button = nodes.find((node) => node.dataset.node === id);
    if (button?.closest<HTMLElement>('li')?.hidden && filter) {
      filter.value = '';
      applyFilter();
    }
    if (focus) {
      const panel = panels.get(id);
      panel?.setAttribute('tabindex', '-1');
      panel?.focus({ preventScroll: true });
      const rect = panel?.getBoundingClientRect();
      if (rect && (rect.top < 0 || rect.top > window.innerHeight * 0.7)) {
        panel?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
  };

  const applyFilter = () => {
    const query = (filter?.value ?? '').trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll<HTMLElement>('.explorer-group').forEach((group) => {
      let visible = 0;
      group.querySelectorAll<HTMLElement>('li').forEach((item) => {
        const id = item.querySelector<HTMLElement>('[data-node]')?.dataset.node ?? '';
        const hit = query === '' || id.toLowerCase().includes(query);
        item.hidden = !hit;
        if (hit) visible += 1;
      });
      group.hidden = visible === 0;
      shown += visible;
    });
    if (count) count.textContent = query === '' ? `共 ${nodes.length} 项` : `匹配 ${shown} / ${nodes.length} 项`;
  };

  for (const node of nodes) {
    node.addEventListener('click', () => select(node.dataset.node ?? '', false));
  }
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-goto]') : null;
    if (!target) return;
    select(target.dataset.goto ?? '', true);
  });
  filter?.addEventListener('input', applyFilter);

  applyFilter();
  select(nodes[0].dataset.node ?? '', false);
}

document.querySelectorAll<HTMLElement>('[data-explorer]').forEach(initExplorer);

export {};
