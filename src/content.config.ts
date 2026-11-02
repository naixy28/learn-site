import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { DOMAINS, SOURCE_TYPES, STATUSES, VALUES } from './lib/taxonomy';

const items = defineCollection({
  loader: glob({
    base: './src/content/items',
    pattern: '**/*.{md,mdx}',
  }),
  schema: z.object({
    title: z.string(),
    source_url: z.string().url(),
    source_type: z.enum(SOURCE_TYPES),
    domain: z.enum(DOMAINS),
    value: z.enum(VALUES),
    value_reason: z.string(),
    status: z.enum(STATUSES),
    added: z.coerce.date(),
    completed: z.coerce.date().optional(),
    notion_url: z.string().url().optional(),
    summary: z.string(),
    terms: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]+$/),
          term: z.string().min(1),
          definition: z.string().min(1),
        }),
      )
      .optional(),
  }),
});

export const collections = { items };
