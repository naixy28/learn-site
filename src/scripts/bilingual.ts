/**
 * 中英对照。正文里的 .bi 块放一段 .bi-en 原文和一段 .bi-zh 解读；
 * [data-bi-switch] 里的按钮切换显示方式，选择存在这台浏览器里。
 */
const KEY = 'learn-site-bilingual';
const MODES = ['stack', 'side', 'zh', 'en'] as const;
type Mode = (typeof MODES)[number];

function isMode(value: string | null | undefined): value is Mode {
  return MODES.includes(value as Mode);
}

function load(): Mode {
  try {
    const raw = localStorage.getItem(KEY);
    return isMode(raw) ? raw : 'stack';
  } catch {
    return 'stack';
  }
}

function initBilingual() {
  const switches = [...document.querySelectorAll<HTMLElement>('[data-bi-switch]')];
  if (switches.length === 0 || !document.querySelector('.bi')) return;
  const root = document.documentElement;
  const apply = (mode: Mode) => {
    root.dataset.biMode = mode;
    for (const group of switches) {
      group.querySelectorAll<HTMLButtonElement>('[data-bi-mode]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.biMode === mode));
      });
    }
  };
  for (const group of switches) {
    group.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-bi-mode]') : null;
      const mode = button?.dataset.biMode;
      if (!isMode(mode)) return;
      apply(mode);
      try {
        localStorage.setItem(KEY, mode);
      } catch {
        /* 无痕模式写不进去 */
      }
    });
  }
  apply(load());
}

initBilingual();

export {};
