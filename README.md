# The Go Reference

A visual, Go-first reference for Go engineers — spanning the whole stack from the language
itself to internals, systems and architecture — with diagrams, **runnable** Go code, quizzes
and progress tracking. Built with [Astro](https://astro.build) + MDX.

Eleven tracks today (more can be added the same way):

- **`/fundamentals/`** — the language itself: syntax and types, functions and pointers, structs, methods and interfaces, generics, and idiomatic errors.
- **`/patterns/`** — all 23 Gang-of-Four patterns + 9 Go concurrency patterns.
- **`/concurrency/`** — a deep guide: Foundations → Building Blocks → Coordination & Scale → Runtime.
- **`/dsa/`** — data structures & algorithms, from Big-O to graphs and dynamic programming.
- **`/stdlib/`** — the standard library & tooling: fmt/io, encoding/json, files and CLIs, slog, testing, benchmarks, the race detector and pprof.
- **`/web/`** — networking & web: TCP/UDP, net/http, routing and middleware, REST and gRPC, WebSockets, TLS, and database/sql.
- **`/internals/`** — how Go runs under the hood: stack/heap, escape analysis, the allocator and GC, interfaces' itab, the scheduler, and the toolchain.
- **`/systems/`** — systems programming: syscalls and file descriptors, processes and signals, file watching, pipes and Unix sockets, mmap.
- **`/security/`** — offensive and defensive security: authorized testing, recon, fuzzing, cryptography done right, and secure coding.
- **`/cloud/`** — cloud-native: containers and Kubernetes, health and lifecycle, observability, messaging, and resilience patterns.
- **`/architecture/`** — designing systems that last: DDD, hexagonal/clean architecture, Go project layout, and the monolith-vs-microservices decision.

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
| `src/content/<track>/*.{md,mdx}` | Track pages, one file each — one folder per track (`patterns/`, `concurrency/`, `fundamentals/`, `dsa/`, `stdlib/`, `web/`, `internals/`, `systems/`, `security/`, `cloud/`, `architecture/`). |
| `src/content.config.ts` | Shared front-matter schema; one collection per track. |
| `src/pages/index.astro` | The hub home (track picker). |
| `src/pages/<track>/` | Each track's landing (`index.astro`) + page route (`[...slug].astro`). |
| `src/layouts/` | `BaseLayout` (site chrome) and `PageLayout` (the per-page anatomy, used by every track). |
| `src/components/` | UI pieces: `Card`, `CategorySection`, `PageHeader`, `Callout`, `Mermaid`, … and `islands/Playground.tsx` (the React runnable editor). |
| `src/lib/consts.ts` | Site metadata + the category lists for each track. |
| `src/scripts/` | `progress.js` (localStorage progress, quiz, TOC) and `mermaid.js` (lazy diagrams). |
| `src/pages/api/run.ts` | On-demand endpoint proxying the Go Playground compile API. |

## Authoring a page

A page is a single `.mdx` file in the relevant collection (`src/content/<track>/`). Front
matter (`title`, `category`, `order`, `intent`, `related`,
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

Eleven tracks, ~196 pages in total:

| Track | Pages |
|---|---|
| Go Fundamentals (`/fundamentals/`) | 17 |
| Design Patterns (`/patterns/`) | 35 |
| Concurrency (`/concurrency/`) | 15 |
| Data Structures & Algorithms (`/dsa/`) | 18 |
| Standard Library & Tooling (`/stdlib/`) | 18 |
| Networking & Web (`/web/`) | 20 |
| Go Internals (`/internals/`) | 12 |
| Systems Programming (`/systems/`) | 10 |
| Security (`/security/`) | 22 |
| Cloud-Native (`/cloud/`) | 23 |
| Architecture (`/architecture/`) | 6 |
