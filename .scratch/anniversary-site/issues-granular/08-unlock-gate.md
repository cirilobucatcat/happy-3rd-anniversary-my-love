# 08 Unlock gate

Status: open
Slice: 3
Type: task
Blocked by: 01

## What to build

An opening screen with a question only she can answer. The site stays hidden and does not scroll until the answer is right. It is a soft gate, not real security.

- Question and accepted answers live in `content/memories.ts` (accept a few spellings, ignore case and spaces).
- Gentle wrong-answer feedback; a nice transition into the sky when right.
- The first tap here also unlocks audio playback on iOS.

## Needs from the user

The question and the answer(s).

## Acceptance criteria

- [ ] Wrong answers show a kind message and do not reveal the answer.
- [ ] The right answer fades the gate out and enables scrolling.
- [ ] Works with the iOS on-screen keyboard (no layout break).
