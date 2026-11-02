import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Window } from 'happy-dom';

type MdastNode = {
  type: string;
  value?: string;
  lang?: string;
  children?: MdastNode[];
};

type VFileLike = { path?: string };

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

const FONT = 16;

let mermaidApi: MermaidApi | null = null;
let sequence = 0;
let renderChain: Promise<unknown> = Promise.resolve();

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function textWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (char === '\n') continue;
    const code = char.codePointAt(0) ?? 0;
    width += code > 0xff ? FONT : FONT * 0.6;
  }
  return width;
}

function measureText(text: string): { x: number; y: number; width: number; height: number } {
  const lines = String(text || '').split('\n');
  const width = Math.max(FONT, ...lines.map((line) => textWidth(line)), FONT);
  const height = Math.max(FONT + 4, Math.max(lines.length, 1) * (FONT + 6));
  return { x: 0, y: -height + 4, width, height };
}

function attr(el: Element, name: string): number {
  return Number(el.getAttribute(name) || 0);
}

function childShift(el: Element): [number, number] {
  const transform = el.getAttribute('transform') || '';
  const match = /translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/.exec(transform);
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

function localBox(el: Element): { x: number; y: number; width: number; height: number } {
  const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'text' || tag === 'tspan') return measureText(el.textContent || '');
  if (tag === 'rect') {
    const width = attr(el, 'width');
    const height = attr(el, 'height');
    if (width || height) return { x: attr(el, 'x'), y: attr(el, 'y'), width, height };
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const points = (el.getAttribute('points') || '').trim().split(/\s+/);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      const [x, y] = point.split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (minX !== Infinity) return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const child of el.children) {
    const box = localBox(child);
    if (box.width === 0 && box.height === 0) continue;
    const [dx, dy] = childShift(child);
    any = true;
    minX = Math.min(minX, box.x + dx);
    minY = Math.min(minY, box.y + dy);
    maxX = Math.max(maxX, box.x + dx + box.width);
    maxY = Math.max(maxY, box.y + dy + box.height);
  }
  if (!any) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

async function loadMermaid(): Promise<MermaidApi> {
  if (mermaidApi) return mermaidApi;
  const window = new Window({ url: 'https://learn.technokong.xyz/' });
  const globals = globalThis as typeof globalThis & Record<string, unknown>;
  globals.window = window as unknown as typeof globalThis.window;
  globals.document = window.document as unknown as Document;
  globals.DOMParser = window.DOMParser as unknown as typeof DOMParser;
  globals.XMLSerializer = window.XMLSerializer as unknown as typeof XMLSerializer;
  globals.HTMLElement = window.HTMLElement as unknown as typeof HTMLElement;
  globals.SVGElement = window.SVGElement as unknown as typeof SVGElement;
  globals.Element = window.Element as unknown as typeof Element;
  globals.Node = window.Node as unknown as typeof Node;
  globals.MutationObserver = window.MutationObserver as unknown as typeof MutationObserver;
  Object.defineProperty(globals, 'navigator', { value: window.navigator, configurable: true });
  globals.getComputedStyle = window.getComputedStyle.bind(window) as unknown as typeof getComputedStyle;
  globals.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 16) as unknown as number;
  globals.cancelAnimationFrame = (id: number) => clearTimeout(id);

  class CSSStyleSheetPolyfill {
    cssRules: Array<{ cssText: string }> = [];
    insertRule(rule: string, index = this.cssRules.length) {
      this.cssRules.splice(index, 0, { cssText: rule });
      return index;
    }
    deleteRule(index: number) {
      this.cssRules.splice(index, 1);
    }
    replaceSync(text: string) {
      this.cssRules = [{ cssText: text }];
    }
    replace(text: string) {
      this.replaceSync(text);
      return Promise.resolve();
    }
  }
  globals.CSSStyleSheet = CSSStyleSheetPolyfill as unknown as typeof CSSStyleSheet;

  const graphics = window.SVGGraphicsElement.prototype as unknown as {
    getBBox: (this: Element) => { x: number; y: number; width: number; height: number };
    getComputedTextLength: (this: Element) => number;
  };
  graphics.getBBox = function getBBox(this: Element) {
    return localBox(this);
  };
  graphics.getComputedTextLength = function getComputedTextLength(this: Element) {
    return textWidth(this.textContent || '');
  };

  const require = createRequire(pathToFileURL(`${process.cwd()}/package.json`));
  const entry = pathToFileURL(require.resolve('mermaid')).href;
  // Vite rewrites import(), which loads mermaid before the DOM shim exists.
  const nativeImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<{ default?: MermaidApi } & MermaidApi>;
  const loaded = await nativeImport(entry);
  mermaidApi = loaded.default?.initialize ? loaded.default : loaded;
  return mermaidApi;
}

function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = renderChain.then(task, task);
  renderChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function themeConfig(dark: boolean): Record<string, unknown> {
  return {
    startOnLoad: false,
    securityLevel: 'loose',
    suppressErrorRendering: true,
    look: 'classic',
    htmlLabels: false,
    theme: 'base',
    flowchart: {
      padding: 14,
      nodeSpacing: 28,
      rankSpacing: 36,
      htmlLabels: false,
      useMaxWidth: true,
      diagramPadding: 8,
    },
    themeVariables: {
      darkMode: dark,
      background: dark ? '#121820' : '#f4f7fb',
      primaryColor: dark ? '#1c314d' : '#e6eef8',
      primaryTextColor: dark ? '#e6ebf2' : '#1c2430',
      primaryBorderColor: dark ? '#9eb7e5' : '#1f4b99',
      secondaryColor: dark ? '#1a2330' : '#f4f7fb',
      tertiaryColor: dark ? '#1a2330' : '#f7f9fc',
      lineColor: dark ? '#9eb7e5' : '#3d516b',
      textColor: dark ? '#e6ebf2' : '#1c2430',
      fontSize: '16px',
      fontFamily: 'PingFang SC, Noto Sans CJK SC, sans-serif',
      clusterBkg: dark ? '#1a2330' : '#f7f9fc',
      clusterBorder: dark ? '#9eb7e5' : '#1f4b99',
      titleColor: dark ? '#e6ebf2' : '#1c2430',
      edgeLabelBackground: dark ? '#121820' : '#f4f7fb',
      nodeTextColor: dark ? '#e6ebf2' : '#1c2430',
    },
  };
}

function splitCaption(source: string): { code: string; caption: string } {
  const lines = source.split('\n');
  const captions: string[] = [];
  const code = lines
    .filter((line) => {
      const match = /^%%\s*图[:：]\s*(.+)$/.exec(line.trim());
      if (!match) return true;
      captions.push(match[1].trim());
      return false;
    })
    .join('\n');
  return { code, caption: captions.join(' ') };
}

function assertLayout(svg: string, where: string) {
  const match = /viewBox="[-\d.]+ [-\d.]+ ([-\d.]+) ([-\d.]+)"/.exec(svg);
  const width = match ? Number(match[1]) : 0;
  const height = match ? Number(match[2]) : 0;
  if (width < 40 || height < 24) {
    throw new Error(`Mermaid 图没有排出可用布局（${where}，viewBox ${width}×${height}）`);
  }
}

function sizeSvg(svg: string): string {
  const match = /viewBox="[-\d.]+ [-\d.]+ ([-\d.]+) ([-\d.]+)"/.exec(svg);
  if (!match) return svg;
  const width = Math.ceil(Number(match[1]) + 16);
  const height = Math.ceil(Number(match[2]) + 16);
  let next = svg.replace(/\swidth="[^"]*"/, ` width="${width}"`);
  if (!/\swidth=/.test(next)) next = next.replace('<svg', `<svg width="${width}"`);
  next = /\sheight=/.test(next)
    ? next.replace(/\sheight="[^"]*"/, ` height="${height}"`)
    : next.replace('<svg', `<svg height="${height}"`);
  return next.replace(/\sstyle="[^"]*"/, '');
}

function harden(svg: string): string {
  return sizeSvg(
    svg
      .replaceAll(/<script[\s\S]*?<\/script>/gi, '')
      .replaceAll(/\son\w+="[^"]*"/gi, '')
      .replaceAll(/\son\w+='[^']*'/gi, ''),
  );
}

/** 构建时把 ```mermaid 画成浅色、深色两份 SVG。 */
export function remarkMermaid() {
  return async (tree: MdastNode, file: VFileLike) => {
    const blocks: Array<{ parent: MdastNode; index: number; value: string }> = [];
    const walk = (node: MdastNode) => {
      node.children?.forEach((child, index) => {
        if (child.type === 'code' && child.lang === 'mermaid') {
          blocks.push({ parent: node, index, value: child.value || '' });
        } else {
          walk(child);
        }
      });
    };
    walk(tree);
    if (blocks.length === 0) return;

    await exclusive(async () => {
    const mermaid = await loadMermaid();
    for (const block of blocks.reverse()) {
      sequence += 1;
      const { code, caption } = splitCaption(block.value);
      const where = file.path ?? '未知文件';
      let light = '';
      let dark = '';
      try {
        mermaid.initialize(themeConfig(false));
        light = harden((await mermaid.render(`mmd${sequence}l`, code)).svg);
        mermaid.initialize(themeConfig(true));
        dark = harden((await mermaid.render(`mmd${sequence}d`, code)).svg);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Mermaid 渲染失败（${where}）：${message}\n${code.slice(0, 240)}`);
      }
      assertLayout(light, where);
      assertLayout(dark, where);
      const captionHtml = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '';
      block.parent.children?.splice(block.index, 1, {
        type: 'html',
        value:
          `<figure class="diagram">` +
          `<div class="diagram-light" aria-hidden="true">${light}</div>` +
          `<div class="diagram-dark" aria-hidden="true">${dark}</div>` +
          captionHtml +
          `</figure>`,
      });
    }
    });
  };
}
