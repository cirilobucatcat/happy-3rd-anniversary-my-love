# 10 Audio

Status: open
Slice: 4
Type: task
Blocked by: 01

## What to build

- A sound button that plays and pauses one song.
- Music starts only after a user tap (browsers block autoplay, and iOS Safari is strict about it).
- If `SITE.song` is empty, the button is hidden and the site works silently.

## Needs from the user

The song as an MP3 (around 3 to 4 MB).

## Acceptance criteria

- [ ] On iPhone Safari, music starts after a tap and pauses on a second tap.
- [ ] Nothing breaks when no song is configured.
- [ ] The button state matches what is playing.
