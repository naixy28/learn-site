import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import { remarkGlossary } from './src/lib/remark-glossary.ts';
import { remarkMermaid } from './src/lib/remark-mermaid.ts';
import { rehypeWrapTables } from './src/lib/rehype-tables.ts';

export default defineConfig({
  site: 'https://learn.technokong.xyz',
  trailingSlash: 'always',
  integrations: [mdx()],
  vite: {
    ssr: {
      external: ['mermaid', 'happy-dom'],
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkGlossary, remarkMermaid],
      rehypePlugins: [rehypeWrapTables],
    }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
    },
  },
  build: {
    format: 'directory',
  },
});
