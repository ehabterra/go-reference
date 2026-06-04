import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const patterns = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/patterns' }),
  schema: z.object({
    title: z.string(),
    category: z.enum([
      'foundations',
      'creational',
      'structural',
      'behavioral',
      'concurrency',
      'stdlib',
      'practice',
    ]),
    kind: z.enum(['pattern', 'guide']).default('pattern'),
    order: z.number(),
    difficulty: z.string(),
    gof: z.boolean().default(false),
    status: z.enum(['stub', 'ready']).default('stub'),
    intent: z.string(),
    nutshell: z.string().optional(),
    aka: z.string().optional(),
    source: z.string().optional(),
    playground: z.string().optional(),
    related: z.array(z.string()).default([]),
    when_use: z.array(z.string()).default([]),
    when_avoid: z.array(z.string()).default([]),
    quiz: z
      .array(
        z.object({
          q: z.string(),
          options: z.array(
            z.object({
              text: z.string(),
              correct: z.boolean().default(false),
            }),
          ),
          explain: z.string().optional(),
        }),
      )
      .default([]),
  }),
});

export const collections = { patterns };
