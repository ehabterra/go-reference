# The Go Reference

A visual, Go-first reference for Go engineers — covering **design patterns** and **concurrency**,
with diagrams, **runnable** Go code, quizzes and progress tracking. Built with
[Astro](https://astro.build) + MDX, deployed on Vercel.

Two tracks today (more can be added the same way):

- **`/patterns/`** — all 23 Gang-of-Four patterns + 9 Go concurrency patterns.
- **`/concurrency/`** — a deep guide: Foundations → Building Blocks → Coordination & Scale → Runtime.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # build (static output → .vercel/output/static/)
npm run preview  # serve the production build
```

> The in-page **Go Playground** "Run" button posts to the Astro endpoint `src/pages/api/run.ts`,
> which proxies the official Go Playground compile API. It runs under `npm run dev` and deploys
> as a Vercel serverless function — so "Run" works both locally and in production.

## How it's organized

| Path | What |
|---|---|
| `src/content/patterns/*.{md,mdx}` | Design-pattern pages (one file each). |
| `src/content/concurrency/*.mdx` | Concurrency-track pages (one file each). |
| `src/content.config.ts` | Shared front-matter schema; one collection per track. |
| `src/pages/index.astro` | The hub home (track picker). |
| `src/pages/{patterns,concurrency}/` | Each track's landing (`index.astro`) + page route (`[...slug].astro`). |
| `src/layouts/` | `BaseLayout` (site chrome) and `PageLayout` (the per-page anatomy, used by both tracks). |
| `src/components/` | UI pieces: `Card`, `CategorySection`, `PageHeader`, `Callout`, `Mermaid`, … and `islands/Playground.tsx` (the React runnable editor). |
| `src/lib/consts.ts` | Site metadata + the category lists for each track. |
| `src/scripts/` | `progress.js` (localStorage progress, quiz, TOC) and `mermaid.js` (lazy diagrams). |
| `src/pages/api/run.ts` | On-demand endpoint proxying the Go Playground compile API (dev + Vercel). |

## Authoring a page

A page is a single `.mdx` file in the relevant collection (`src/content/patterns/` or
`src/content/concurrency/`). Front matter (`title`, `category`, `order`, `intent`, `related`,
`when_use`/`when_avoid`, `quiz`, …) drives the header, badges, related cards, trade-offs and quiz.
Write the body with `<Callout>`, `<Mermaid code={…} />` and `<Playground client:visible code={…} />`.
See `concurrency/channels.mdx` or `patterns/strategy.mdx` as templates.

Adding a whole new **track** = a new collection in `content.config.ts`, a `src/content/<track>/`
folder, a landing + `[...slug].astro` under `src/pages/<track>/`, and a category list in
`consts.ts`. The shared components already take `collection` / `base` props.

## Deploy to Vercel

1. Create a GitHub repo named `go-reference` and push this folder to it.
2. Import the repo in Vercel — it auto-detects Astro. No env vars needed.
3. The static site + the `/api/run` function deploy together.

## Content status

- **Design Patterns:** complete (35 pages).
- **Concurrency:** in progress — Foundations and Building Blocks done; Coordination & Runtime being written.
