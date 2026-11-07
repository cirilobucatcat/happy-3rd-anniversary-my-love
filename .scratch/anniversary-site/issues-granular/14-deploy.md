# 14 Deploy

Status: open
Slice: 4
Type: task
Blocked by: 12

## What to build

Get the site online at one private link.

- Run `npm run build` and deploy the generated `out/` folder with Netlify drag-and-drop (no git or GitHub account needed).
- Use an unguessable site name and turn off search indexing (`noindex` in the page metadata).
- Write step-by-step instructions the user can follow, and test the live link on the iPhone.

## Acceptance criteria

- [ ] The live link opens the gate, then the full experience, on iPhone Safari.
- [ ] The page carries `noindex` and is not listed in search.
- [ ] The user has a short checklist for the day: what to send, what to test one last time.
