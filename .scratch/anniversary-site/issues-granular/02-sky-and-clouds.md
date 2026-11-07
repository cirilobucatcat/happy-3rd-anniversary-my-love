# 02 Sky and clouds

Status: open
Slice: 1
Type: task
Blocked by: 01

## What to build

The pink sky that changes with scroll progress.

- Four fixed gradient layers (dawn pink at 0.00, bright pink day at 0.35, sunset at 0.70, deep rose with stars at 1.00) cross-fading with opacity only.
- Clouds on 2 or 3 depth layers with different parallax speeds, plus stars that fade in near the end.
- The final colours must stay light enough for black Flyers to read.

## Acceptance criteria

- [ ] At `?p=0`, `?p=0.35`, `?p=0.7` and `?p=1` the sky matches the table in the spec.
- [ ] Only `transform` and `opacity` are animated.
- [ ] Clouds drift at different speeds by depth.
- [ ] Screenshots at phone and laptop sizes look right.
