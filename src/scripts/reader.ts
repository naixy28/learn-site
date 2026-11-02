type TryState = { text: string; thought: boolean; open: boolean };
type ItemState = { max: number; learned: boolean; tries: Record<string, TryState> };
type Store = Record<string, ItemState>;

const KEY = 'learn-site-progress';

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* 无痕模式写不进去 */
  }
}

function blank(): ItemState {
  return { max: 0, learned: false, tries: {} };
}

function pct(state: ItemState): number {
  return Math.max(0, Math.min(100, Math.round(state.max * 100)));
}

function readout(state: ItemState): string {
  const seen = pct(state);
  if (state.learned && seen > 0) return `本机已学，读到 ${seen}%`;
  if (state.learned) return '本机已学';
  if (seen > 0) return `本机读到 ${seen}%`;
  return '本机还没有阅读记录';
}

function paintCards(store: Store) {
  document.querySelectorAll<HTMLElement>('[data-item-id]').forEach((card) => {
    const id = card.dataset.itemId;
    const slot = card.querySelector<HTMLElement>('[data-local-read]');
    if (!id || !slot) return;
    const state = store[id];
    if (!state || (state.max < 0.02 && !state.learned)) {
      slot.hidden = true;
      slot.textContent = '';
      return;
    }
    slot.hidden = false;
    slot.textContent = readout(state);
  });
}

function paintRail(value: number) {
  const span = document.querySelector<HTMLElement>('[data-read-rail]');
  const bar = document.querySelector<HTMLElement>('[data-read-progress]');
  if (bar) {
    bar.setAttribute('aria-valuenow', String(value));
    bar.setAttribute('aria-valuetext', `本机读到 ${value}%`);
  }
  if (!span) return;
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  if (mobile) {
    span.style.width = `${value}%`;
    span.style.height = '100%';
  } else {
    span.style.height = `${value}%`;
    span.style.width = '100%';
  }
}

function initReader(store: Store) {
  const root = document.querySelector<HTMLElement>('[data-reader]');
  const id = root?.dataset.reader;
  if (!root || !id) return;
  const state = store[id] ?? blank();
  store[id] = state;

  const prose = root.querySelector<HTMLElement>('.prose');
  const readoutEl = document.querySelector<HTMLElement>('#local-readout');
  const button = document.querySelector<HTMLButtonElement>('#mark-learned');

  const paintLocal = () => {
    paintRail(pct(state));
    if (readoutEl) readoutEl.textContent = readout(state);
    if (button) button.setAttribute('aria-pressed', String(state.learned));
    paintCards(store);
  };

  const persist = () => {
    save(store);
    paintLocal();
  };

  if (prose) {
    const measure = () => {
      const rect = prose.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const viewed = window.scrollY + window.innerHeight - start;
      const height = prose.offsetHeight;
      const ratio = height <= 0 ? 0 : Math.min(1, Math.max(0, viewed / height));
      if (ratio > state.max + 0.004) {
        state.max = ratio;
        persist();
      } else {
        paintRail(pct(state));
      }
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', () => {
      paintRail(pct(state));
      measure();
    });
  }

  button?.addEventListener('click', () => {
    state.learned = !state.learned;
    persist();
  });

  root.querySelectorAll<HTMLElement>('.try').forEach((block) => {
    const tryId = block.dataset.try;
    const input = block.querySelector<HTMLTextAreaElement>('[data-try-input]');
    const thought = block.querySelector<HTMLInputElement>('[data-try-thought]');
    const reveal = block.querySelector<HTMLButtonElement>('[data-try-reveal]');
    const answer = block.querySelector<HTMLElement>('.try-answer');
    if (!tryId || !input || !thought || !reveal || !answer) return;
    const saved = state.tries[tryId] ?? { text: '', thought: false, open: false };
    state.tries[tryId] = saved;
    input.value = saved.text;
    thought.checked = saved.thought;

    const ready = () => input.value.trim().length > 0 || thought.checked;
    const paintTry = () => {
      answer.hidden = !saved.open;
      reveal.textContent = saved.open ? '收起答案' : '看答案';
      reveal.setAttribute('aria-expanded', String(saved.open));
      reveal.disabled = !saved.open && !ready();
    };
    const remember = () => {
      saved.text = input.value;
      saved.thought = thought.checked;
      persist();
      paintTry();
    };
    input.addEventListener('input', remember);
    thought.addEventListener('change', remember);
    reveal.addEventListener('click', () => {
      if (!saved.open && !ready()) return;
      saved.open = !saved.open;
      remember();
    });
    paintTry();
  });

  paintLocal();
}

function initTerms() {
  let openTerm: HTMLElement | null = null;
  const close = (term: HTMLElement | null) => {
    if (!term) return;
    const button = term.querySelector<HTMLButtonElement>('.term-btn');
    const note = term.querySelector<HTMLElement>('.term-note');
    term.classList.remove('is-open', 'is-pinned');
    if (button) button.setAttribute('aria-expanded', 'false');
    if (note) note.hidden = true;
    if (openTerm === term) openTerm = null;
  };
  const open = (term: HTMLElement, pin: boolean) => {
    if (openTerm && openTerm !== term) close(openTerm);
    const button = term.querySelector<HTMLButtonElement>('.term-btn');
    const note = term.querySelector<HTMLElement>('.term-note');
    term.classList.add('is-open');
    term.classList.toggle('is-pinned', pin);
    if (button) button.setAttribute('aria-expanded', 'true');
    if (note) note.hidden = false;
    openTerm = term;
  };

  const hover = window.matchMedia('(hover: hover)').matches;
  document.querySelectorAll<HTMLElement>('.term').forEach((term) => {
    const button = term.querySelector<HTMLButtonElement>('.term-btn');
    if (!button) return;
    if (hover) {
      term.addEventListener('mouseenter', () => {
        if (!term.classList.contains('is-pinned')) open(term, false);
      });
      term.addEventListener('mouseleave', () => {
        if (!term.classList.contains('is-pinned')) close(term);
      });
    }
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (term.classList.contains('is-pinned')) close(term);
      else open(term, true);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close(openTerm);
  });
  document.addEventListener('click', (event) => {
    if (!openTerm?.classList.contains('is-pinned')) return;
    if (event.target instanceof Node && openTerm.contains(event.target)) return;
    close(openTerm);
  });
}

function initToc() {
  const toc = document.querySelector<HTMLElement>('.toc');
  if (!toc) return;
  const toggle = toc.querySelector<HTMLButtonElement>('#toc-toggle');
  const current = toc.querySelector<HTMLElement>('[data-toc-current]');
  const links = [...toc.querySelectorAll<HTMLAnchorElement>('a')];
  const pairs = links
    .map((link) => {
      const id = decodeURIComponent((link.getAttribute('href') || '').replace(/^#/, ''));
      return { link, heading: id ? document.getElementById(id) : null };
    })
    .filter((pair): pair is { link: HTMLAnchorElement; heading: HTMLElement } => Boolean(pair.heading));

  const setCurrent = (pair: { link: HTMLAnchorElement; heading: HTMLElement } | undefined) => {
    if (!pair) return;
    for (const link of links) {
      if (link === pair.link) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    if (current) current.textContent = pair.link.textContent?.trim() || '目录';
  };

  const spy = () => {
    const header = document.querySelector('.site-header');
    const line = (header?.getBoundingClientRect().height ?? 64) + 28;
    let active = pairs[0];
    for (const pair of pairs) {
      if (pair.heading.getBoundingClientRect().top <= line) active = pair;
    }
    setCurrent(active);
  };

  spy();
  window.addEventListener('scroll', spy, { passive: true });

  toggle?.addEventListener('click', () => {
    const open = toc.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  for (const link of links) {
    link.addEventListener('click', () => {
      if (!window.matchMedia('(max-width: 900px)').matches) return;
      toc.classList.remove('is-open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  }
}

const store = load();
paintCards(store);
initReader(store);
initTerms();
initToc();
window.addEventListener('storage', (event) => {
  if (event.key !== KEY) return;
  const next = load();
  paintCards(next);
});
