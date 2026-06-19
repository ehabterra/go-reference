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
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # build (output → dist/, including the SSR Worker)
pnpm preview  # serve the production build
```

> The in-page **Go Playground** "Run" button posts to the Astro endpoint `src/pages/api/run.ts`,
> which proxies the official Go Playground compile API. It runs under `pnpm dev` and deploys
> as part of the Cloudflare Worker — so "Run" works both locally and in production.

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
| `astro.config.mjs` | Astro config — uses the Cloudflare adapter for SSR on Workers. |
| `wrangler.jsonc` | Cloudflare Worker config (entry, static assets, compatibility flags). |

## Authoring a page

A page is a single `.mdx` file in the relevant collection (`src/content/<track>/`). Front
matter (`title`, `category`, `order`, `intent`, `related`,
`when_use`/`when_avoid`, `quiz`, …) drives the header, badges, related cards, trade-offs and quiz.
Write the body with `<Callout>`, `<Mermaid code={…} />` and `<Playground client:visible code={…} />`.
See `concurrency/channels.mdx` or `patterns/strategy.mdx` as templates.

Adding a whole new **track** = a new collection in `content.config.ts`, a `src/content/<track>/`
folder, a landing + `[...slug].astro` under `src/pages/<track>/`, and a category list in
`consts.ts`. The shared components already take `collection` / `base` props.

## Deploy to Cloudflare Workers

The site runs as a Cloudflare Worker (SSR via the `@astrojs/cloudflare` adapter), with
static assets served from `dist/`. Build first, then deploy with Wrangler:

```bash
pnpm build
pnpm wrangler deploy
```

The Worker entry, static-assets binding, and compatibility settings live in `wrangler.jsonc`.
No env vars are required. Connecting the GitHub repo to Cloudflare's CI (build command
`pnpm build`) deploys automatically on push.

## Content status

Eleven tracks, ~198 pages in total:

| Track | Pages |
|---|---|
| Go Fundamentals (`/fundamentals/`) | 18 |
| Design Patterns (`/patterns/`) | 35 |
| Concurrency (`/concurrency/`) | 15 |
| Data Structures & Algorithms (`/dsa/`) | 18 |
| Standard Library & Tooling (`/stdlib/`) | 18 |
| Networking & Web (`/web/`) | 21 |
| Go Internals (`/internals/`) | 12 |
| Systems Programming (`/systems/`) | 10 |
| Security (`/security/`) | 22 |
| Cloud-Native (`/cloud/`) | 23 |
| Architecture (`/architecture/`) | 6 |

## Contributing

Contributions are welcome — from a one-line typo fix to a whole new track. See
[CONTRIBUTING.md](./CONTRIBUTING.md) for the workflow, the project layout, and a
page-authoring checklist.

## License

Licensed under the [Apache License 2.0](./LICENSE) — see [LICENSE](./LICENSE) and
[NOTICE](./NOTICE). This covers both the code and the written content.
