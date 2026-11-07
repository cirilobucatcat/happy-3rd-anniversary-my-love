# Prompts for the couple model (`couple.glb`)

These prompts are for a plain Claude chat (text only, no tools, no MCP). Claude cannot output a binary `.glb` in text, so each prompt makes it write one self-contained HTML page. You open the page in a browser, check the preview, and click **Download couple.glb**.

## How to use

1. Open a new Claude chat.
2. Paste the **Core prompt**, then paste one **Style block** (A, B or C) right after it, in the same message.
3. Claude will ask you a few questions about the look. Answer them.
4. Claude replies with one HTML file. Save it as `couple-maker.html` anywhere and open it in Chrome, Edge or Safari (it needs internet once, to load Three.js).
5. Check the preview (spin it, look at the hands and the dress). If it is off, tell Claude what to change and it returns a fixed HTML file.
6. Click **Download couple.glb** and put the file at `public/models/couple.glb` in this repo.
7. Try the other styles the same way and keep the one you like best.

Not done by these prompts: `lib/flyers.ts` currently replaces every material in a loaded `.glb` with the black matte one, so a coloured model comes out all black until that is changed. Ask for that change once you have picked a variant.

---

## Core prompt (paste first)

````text
I am making a 3rd-anniversary website for my girlfriend. The site has a pink sky, and a small 3D model of the two of us flies across it as she scrolls. I need that model as a `.glb` file.

You cannot send me a binary file in this chat, so please do this instead: write ONE self-contained HTML file that builds the couple in code with Three.js, shows it in a spinning preview, and has a "Download couple.glb" button that exports it with GLTFExporter. I will open the file in my browser.

FIRST, before writing any code, ask me these questions in one short numbered list and wait for my answers:
1. What kind of uniform do I wear (school, suit, military, pilot, work uniform, other)? It is black.
2. My hair: length and colour. Glasses or not?
3. Her hair: length, colour, and style (loose, ponytail, braid).
4. Both skin tones (light / medium / tan / dark, or a hex colour each).
5. Her rose-pink dress: any detail I want (short or knee-length, sleeves, a bow, a ribbon)?
6. One small accessory each, if any (watch, bracelet, necklace, matching rings). "None" is a fine answer.
Do not start building until I have answered. Offer a sensible default for each question so I can reply "defaults".

THE MODEL

- Cute chibi proportions, simple friendly faces (two small dot eyes, small mouth; no nose needed, no realistic features).
- Two people: me (taller, black uniform) and my girlfriend (rose-pink dress). I am about 12% taller than she is.
- They fly side by side, facing the same direction (+X), leaning forward about 30 degrees. One hand each is joined with the other person's hand in the middle, between them. Their other hands are simple rounded mitten shapes with no fingers.
- Her hair and the skirt of her dress are frozen mid-sweep, streaming backwards as if blown by the wind. My hair is short.
- Colours: my uniform is black (a very dark grey like #111111 so the shape still reads, with a slightly lighter detail such as buttons or a collar). Her dress is rose-pink (a deep rose like #E8457E) with a lighter trim or a darker hem, so it does not disappear against a pink sky. Skin and hair colours come from my answers.
- One static pose. No rig, no skeleton, no animation clips. No ground, no stand, no background, no shadow plane, no text, no logos.

THE FILE (technical requirements)

- Three.js version 0.187.0, loaded from a CDN with an import map, for example https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js and https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/ (use GLTFExporter from there; check its API for this version and use it correctly).
- Build everything from primitive geometries (spheres, capsules, cylinders, cones, boxes, lathe, tubes). Merge nothing exotic, import nothing else.
- Use MeshStandardMaterial with flat colours only. No textures, no images, no external assets. Use one small shared material per colour (skin, hair, uniform, dress, trim, etc.).
- Orientation: the couple faces +X, +Y is up, they are side by side along Z. Centre the finished group at the origin, and do not rotate the exported scene root.
- Budget: under 30,000 triangles in total and under 2 MB for the `.glb`. Keep it far under that: use moderate segment counts (for example 16 to 24 around a sphere) so it stays smooth but light.
- Export a binary `.glb` (binary: true) of the couple group only, with no lights and no camera in it.
- The page shows: a spinning preview with OrbitControls and a light pink background (the background must NOT be part of the export), the real triangle count, the real file size of the exported `.glb`, and a clear warning in red if either budget is exceeded.
- A "Download couple.glb" button saves the file with exactly that name.
- Wrap the code in one HTML file. Give it one short comment per body part so I can ask you to tweak it.
- Return only the questions first. After my answers, return only the complete HTML file in one code block, then two lines of notes. Nothing else.

STYLE
````

---

## Style blocks (paste one after the core prompt)

### A. Classic chibi

````text
Classic chibi: a big round head that is about half of the whole height (about 2 heads tall), a small rounded body, short stubby arms and legs, large simple eyes. Smooth shapes with clear, readable silhouettes. Think of a cute collectible figure.
````

### B. Soft plush chibi

````text
Soft plush chibi: even rounder and puffier than a toy. The head is a little smaller than in a classic chibi (about 40% of the height), the body is a soft rounded bean, the arms and legs are short and plump with no sharp edges anywhere. Hair and dress are thick, rounded and puffy, like stitched plush toys. Slightly bigger cheeks, tiny eyes.
````

### C. Minimal chibi

````text
Minimal chibi: use the fewest shapes and triangles possible while still reading as two cute people. Head is a sphere, body a capsule or rounded cone, limbs single capsules, hair and dress each one or two simple shapes. No detail that is not visible at thumbnail size. Aim for under 6,000 triangles in total. This version is for older phones, so lightness matters more than detail.
````
