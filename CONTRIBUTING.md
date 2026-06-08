# Contributing to The Go Reference

Thanks for your interest in improving The Go Reference! This is a visual, Go-first
learning resource — contributions that make a topic clearer, more correct, or more
idiomatic are always welcome, whether that's a one-line typo fix or a whole new track.

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](./LICENSE), the same license that covers the project.

## Ways to contribute

- **Fix an error** — a wrong explanation, a code sample that doesn't compile, a broken link, a typo.
- **Improve a page** — clearer wording, a better diagram, a more idiomatic example, a sharper quiz question.
- **Add a page** — a missing topic within one of the existing tracks.
- **Add a track** — a whole new area (see [Adding a track](#adding-a-track)).
- **Translations** — content lives in `src/i18n/` (UI strings in `ar.json`, per-page content under `src/i18n/content/`).

If you're planning something large (a new track, a structural change), please
open an issue first so we can agree on the shape before you invest the time.

## Getting started

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # production build
npm run preview  # serve the production build
```

The in-page **Run** button posts to `src/pages/api/run.ts`, which proxies the
official Go Playground compile API. It works under `npm run dev` and in production.

## Project layout

| Path | What |
|---|---|
| `src/content/<track>/*.{md,mdx}` | Track pages, one file each (`patterns/`, `concurrency/`, `fundamentals/`, `dsa/`, `stdlib/`, `web/`, `internals/`, `systems/`, `security/`, `cloud/`, `architecture/`). |
| `src/content.config.ts` | Front-matter schema; one collection per track. |
| `src/lib/consts.ts` | Site metadata + the category lists for each track. |
| `src/pages/<track>/` | Each track's landing (`index.astro`) + page route (`[...slug].astro`). |
| `src/components/`, `src/layouts/` | Shared UI and the per-page anatomy. |
| `src/i18n/` | UI strings and per-page translated content. |

## Authoring a page

A page is a single `.mdx` file in the relevant collection, e.g. `src/content/patterns/strategy.mdx`.
Front matter (`title`, `category`, `order`, `intent`, `related`, `when_use`/`when_avoid`,
`quiz`, …) drives the header, badges, related cards, trade-offs and quiz. Write the body
with `<Callout>`, `<Mermaid code={…} />` and `<Playground client:visible code={…} />`.

Use `src/content/concurrency/channels.mdx` or `src/content/patterns/strategy.mdx` as a template.

**Checklist for a good page**

- [ ] Front matter is complete and `category` matches an existing key in `consts.ts`.
- [ ] Every code sample is idiomatic Go and **compiles** — try it in the in-page playground.
- [ ] Diagrams render (`npm run dev` and open the page).
- [ ] The quiz has at least one question with a correct answer and an `explain`.
- [ ] `npm run build` passes with no errors.

## Adding a track

A new track is:

1. A new collection in `src/content.config.ts`.
2. A `src/content/<track>/` folder of `.mdx` pages.
3. A landing + `[...slug].astro` under `src/pages/<track>/`.
4. A category list in `src/lib/consts.ts`.
5. A card on the home page (`src/pages/index.astro`) and matching `data-i18n` strings.

The shared components already take `collection` / `base` props, so most of the work is content.

## Style

- **Go-first, not translated.** Idiomatic Go — interfaces, goroutines and channels — not another language in disguise.
- **Show, then tell.** Lead with a diagram or runnable example where it helps.
- Keep prose tight and concrete. Prefer a runnable example over a paragraph of description.
- Match the voice and structure of existing pages in the same track.

## Submitting a pull request

1. Fork the repo and create a branch (`git checkout -b fix/strategy-typo`).
2. Make your change and run `npm run build` to confirm it's clean.
3. Commit with a clear message describing the change.
4. Open a PR against `master` describing **what** changed and **why**. Screenshots help for visual changes.

A maintainer will review. Small, focused PRs are reviewed fastest.

## Reporting issues

Open a GitHub issue with: the page/URL affected, what's wrong, and (for code) the
error or the expected vs. actual behavior. For security content specifically, keep
examples lab-scoped and defense-paired — see the Security track's framing.

Thank you for helping make Go easier to learn! 🐹
