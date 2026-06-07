import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Shared schema for every reference section (patterns, concurrency, …).
const refSchema = z.object({
  title: z.string(),
  category: z.enum([
    // design-patterns categories
    'foundations',
    'creational',
    'structural',
    'behavioral',
    'concurrency',
    'stdlib',
    'practice',
    // concurrency-reference categories
    'building-blocks',
    'coordination',
    'runtime',
    // data-structures-&-algorithms categories
    'complexity',
    'linear',
    'trees-graphs',
    'algorithms',
    // go-fundamentals categories
    'basics',
    'composite',
    'types-methods',
    'idioms',
    // standard-library-&-tooling categories
    'essentials',
    'system',
    'testing',
    'tooling',
    // networking-&-web categories
    'net-basics',
    'http',
    'apis',
    'data',
    // go-internals categories
    'memory',
    'representation',
    'execution',
    'toolchain',
    // systems-programming categories
    'syscalls',
    'files',
    'processes',
    'ipc',
    // security categories
    'sec-foundations',
    'offensive',
    'cryptography',
    'defense',
    // cloud-native categories
    'containers',
    'observability',
    'messaging',
    'resilience',
    // architecture categories
    'arch-principles',
    'arch-structure',
  ]),
  kind: z.enum(['pattern', 'guide', 'topic']).default('pattern'),
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
});

const patterns = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/patterns' }),
  schema: refSchema,
});

const concurrency = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/concurrency' }),
  schema: refSchema,
});

const dsa = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/dsa' }),
  schema: refSchema,
});

const fundamentals = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/fundamentals' }),
  schema: refSchema,
});

const stdlib = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/stdlib' }),
  schema: refSchema,
});

const web = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/web' }),
  schema: refSchema,
});

const internals = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/internals' }),
  schema: refSchema,
});

const systems = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/systems' }),
  schema: refSchema,
});

const security = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/security' }),
  schema: refSchema,
});

const cloud = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/cloud' }),
  schema: refSchema,
});

const architecture = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/architecture' }),
  schema: refSchema,
});

export const collections = { patterns, concurrency, dsa, fundamentals, stdlib, web, internals, systems, security, cloud, architecture };
