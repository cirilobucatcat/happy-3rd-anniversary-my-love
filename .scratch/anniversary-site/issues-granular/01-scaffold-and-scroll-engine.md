# 01 Scaffold the Next.js app and scroll engine

Status: open
Slice: 1
Type: task
Blocked by: none

## What to build

The empty shell everything else plugs into: a Next.js app, the animation libraries, and the single scroll source.

- Create the app with the latest Next.js (16.4.5 on 2026-11-07), App Router, TypeScript, npm, plain CSS. If `create-next-app` refuses because the folder already holds `ARCHITECTURE.md` and `.scratch/`, scaffold in a temporary folder and move the files in; do not delete either.
- Install `gsap`, `@gsap/react` and `three` as normal dependencies with exact (pinned) versions. Nothing loads from a CDN.
- `next.config.ts`: `output: 'export'`, images unoptimized.
- `components/Experience.tsx` (client component) creates one ScrollTrigger scrub (progress 0 to 1 over the whole page) and one `gsap.ticker` callback. `lib/scroll.ts` exposes the progress and a `subscribe` function that every module uses.
- All setup lives in `useGSAP` or effects with full cleanup, so React Strict Mode's double mount in development leaves exactly one ScrollTrigger and one ticker callback.
- Support `?p=0.4` to start at any progress, read in an effect (never during server render).
- A debug readout of live progress, shown only with `?debug`.
- Add a short README: `npm run dev`, `npm run build`, how to serve `out/`.

## Acceptance criteria

- [ ] `npm run dev` shows a page that scrolls; `npm run build` completes and produces `out/`.
- [ ] No hydration warnings in the browser console.
- [ ] After a hot reload, `?debug` still shows exactly one ScrollTrigger and one ticker callback (no duplicates).
- [ ] `?p=0.4` opens the page at 40%.
- [ ] No scroll listeners exist outside ScrollTrigger.
- [ ] Dependency versions are pinned exactly and nothing loads from a CDN.
