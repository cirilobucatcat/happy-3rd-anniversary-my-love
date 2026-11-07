# 05 Flight path

Status: open
Slice: 2
Type: task
Blocked by: 04

## What to build

The Flyers fly along a route driven by scroll.

- `lib/route.ts` builds a 3D curve from a list of turns: fly right, climb, arc over, dive, one loop, cruise, turn back left.
- Position, banking and heading follow the curve; turning left or right is a real 3D turn, no flip trick.
- The route is fitted to the viewport on resize so it uses the whole screen on phone and laptop.
- A fading trail follows the Flyers.

## Acceptance criteria

- [ ] Scrolling down moves the Flyers along the route; scrolling up reverses it.
- [ ] The route includes at least one climb, one dive, one left turn and exactly one loop.
- [ ] The Flyers stay on screen at every progress value on phone and laptop sizes.
- [ ] Screenshots at several `?p=` values show clear changes in direction.
