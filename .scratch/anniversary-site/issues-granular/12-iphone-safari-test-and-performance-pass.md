# 12 iPhone and Safari test and performance pass

Status: open
Slice: 4
Type: task
Blocked by: 02, 07, 08, 09, 10, 11

## What to build

A full verification pass before shipping.

- Headless screenshots at phone and laptop sizes at key `?p=` values, taken from the production build (`npm run build`, served from `out/`), not only the dev server.
- Check `dvh` layout with the Safari address bar, safe-area insets, and the iOS keyboard on the gate.
- Check frame rate and memory on a real iPhone; cap the pixel ratio and lazy-load photos if needed.
- Add an "Open in Safari for the best experience" hint if the link is opened in an in-app browser.
- Confirm total transfer size is reasonable for mobile data.

## Acceptance criteria

- [ ] Smooth scrolling and flight on a real iPhone, in Safari and in the app the link will be sent through.
- [ ] No horizontal scroll at any width from 360 px up.
- [ ] Photos are resized to about 1600 px and lazy-loaded.
- [ ] A short list of any remaining issues is written down.
