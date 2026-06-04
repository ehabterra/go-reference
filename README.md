# Design Patterns, the Go Way

A visual, Go-first learning website covering every Gang-of-Four design pattern and Go's
essential concurrency patterns — with diagrams, **runnable** Go code, quizzes and progress
tracking. Built with [Astro](https://astro.build) + MDX, deployed on Vercel.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in ./dist
npm run preview  # serve the production build
```

> The in-page **Go Playground** "Run" button calls the serverless function in `/api/run.js`,
> which only runs on Vercel (or via `vercel dev`). Under plain `npm run dev` the page works,
> but "Run" will report it can't reach the runner — that's expected locally.

## How it's organized

| Path | What |
|---|---|
| `src/content/patterns/*.{md,mdx}` | One file per pattern/guide. `.md` = stub (front matter only), `.mdx` = full page. |
| `src/content.config.ts` | Content collection schema (front-matter contract). |
| `src/layouts/` | `BaseLayout` (chrome) and `PatternLayout` (the per-pattern anatomy). |
| `src/components/` | Astro UI pieces; `islands/Playground.tsx` is the React runnable editor. |
| `src/scripts/` | `progress.js` (localStorage progress, quiz, TOC) and `mermaid.js` (lazy diagrams). |
| `api/run.js` | Vercel function proxying the Go Playground compile API. |

## Authoring a pattern page

A new pattern is just a file in `src/content/patterns/`. Front matter drives the header,
badges, related cards, trade-offs and quiz. Set `status: ready` and write the body in MDX
(use `<Callout>`, `<Mermaid code={…} />`, `<Playground client:visible code={…} />`) to turn
a stub into a full page. See `singleton.mdx` and `strategy.mdx` as templates.

## Deploy to Vercel

1. Create a GitHub repo named `design-patterns` and push this folder to it.
2. Import the repo in Vercel — it auto-detects Astro. No env vars needed.
3. The static site + `/api/run` function deploy together.

## Content status

Fully written: **Foundations, Singleton, Strategy, Patterns in the Standard Library**.
The remaining 30 patterns are structured stubs (intent, category, difficulty, ordering,
GitHub source links) ready to be filled in — each renders a "being written" scaffold today.
