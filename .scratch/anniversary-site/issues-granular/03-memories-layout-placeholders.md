# 03 Memories layout with placeholder photos

Status: open
Slice: 1
Type: task
Blocked by: 01

## What to build

Content-driven Memories on the page, using placeholder images.

- `content/memories.ts` holds typed `SITE` and `CHAPTERS`; a `Memories` component renders them.
- About 15 to 20 placeholder Memories spread over the Chapters (generated placeholder images in `public/photos/`).
- Thick black frames, slight tilt, handwritten caption, alternating left and right; about 70% width and staggered on phones.
- Each Memory fades, tilts and drifts in using the shared scroll progress. Photos are plain `<img loading="lazy">`.
- `scripts/resize-photos.mjs` resizes any photo dropped into a source folder to about 1600 px.

## Acceptance criteria

- [ ] Editing only `content/memories.ts` adds, removes or reorders Memories and captions.
- [ ] Phone (about 390 px wide) and laptop layouts both look right in screenshots.
- [ ] Memories animate in with `transform` and `opacity` only.
- [ ] A handwriting font is bundled locally (for example with `next/font/local`), no external font request.

## Notes

Font choice depends on the caption language (still to be decided by the user).
