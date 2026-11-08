# Put it online and send it

The site is static: `npm run build` writes a plain folder, `out/`, and that folder is the whole site. No server, no accounts for her, nothing to keep running.

## 1. Before you build

Everything that is still a stand-in is in `content/memories.ts` and `public/`:

- [ ] `DAY_ONE`, the `GATE` question and answers, the `INTRO`, the `LETTER`, and every Memory's photo and Caption (see the README).
- [ ] Real photos in `public/photos/`, then `npm run resize-photos` (about 1600 px on the long edge). Delete the placeholder `.svg` files.
- [ ] **The song**: copy the MP3 (about 3 to 4 MB) to `public/audio/our-song.mp3` and set `SITE.song` to `"/audio/our-song.mp3"` in `content/memories.ts`. Leave `SITE.song` as `""` and there is no Sound button; the site works silently.
- [ ] Optional: your own `public/models/couple.glb` (at most 2 MB and 30,000 triangles; see the README). The one in there now already flies the whole route.
- [ ] `npm test` and `npm run typecheck` pass, then `npm run build`.
- [ ] `npm start` and open the address it prints. Click through once (gate, scroll, the button, the Letter) before uploading.

## 2. Deploy with Netlify drag and drop

Netlify's free plan is enough. Screens move around now and then, so the names below may be slightly different.

1. Sign in at <https://app.netlify.com>.
2. On the **Sites** page choose **Add new site**, then **Deploy manually**.
3. Drag the **`out`** folder itself (not the project folder, not a zip) onto the drop area. It uploads in a few seconds. The `_headers` file inside it is what tells search engines to stay away from every file; it must be in the upload, and it is, because it lives in `public/`.
4. Give it a name nobody can guess. Open **Site configuration**, then **Site details**, then **Change site name**, and use something random, such as `rose-sky-` plus six to eight random letters and digits. No names, dates or words from your story: the address is the only thing standing between the site and a stranger, on top of the gate's question.
5. Your link is `https://<that-name>.netlify.app`. Send exactly that, with nothing after it (see "Day of" below for why).
6. To change anything later: build again, open the site's **Deploys** tab and drag the new `out` folder onto it.

### Check that search engines are kept away

```bash
curl -I https://<that-name>.netlify.app/
```

The answer should include `x-robots-tag: noindex, nofollow, noimageindex`. And in the browser, "view page source" should show `<meta name="robots" content="noindex, nofollow, nocache">`. (If you changed the title or the head, check the meta tag is still there: `app/noindex.test.ts` also fails if it goes.)

## 3. Day of

**What to send:** only the link, in the app you chose. Do not add `?open`, `?p=` or `?debug` to it: those skip the question on purpose, for your own checks. Do not send the answer to the question. Send it when she can open it on her iPhone with a few quiet minutes (the story takes about four minutes) and ideally on Wi-Fi: the first load is about 0.7 to 0.9 MB (the page and its scripts, compressed, plus the Flyers' model), the Song another 3 to 4 MB once she taps the Sound button, and each photo a few hundred KB as it comes into view.

**What to test one last time, on your own iPhone, using the live link, opened from the same app you will send it through** (the same app matters: that is where the in-app browser problem shows up):

- [ ] The gate opens first. A wrong answer gets a kind message; the right one fades into the sky. The keyboard does not cover the field.
- [ ] Scroll through the whole thing slowly: smooth, nothing blank, the Flyers on screen the whole way, the Letter readable on the card, the Closing line at the end.
- [ ] Tap the Sound button: the Song starts (give it a second or two over mobile data). Tap again: it pauses. Try it with the side switch on silent and with the volume up. If the button vanishes when you tap it, the Song's path or file is wrong.
- [ ] Switch to another app for a few seconds and come back: the sky and the Flyers are still there and the music (if it was playing) carries on.
- [ ] If the link opened in the app's own browser, an "Open in Safari for the best experience" note shows at the top. Dismiss it, check the site still works, then open it in Safari too.
- [ ] Settings, Accessibility, Motion, **Reduce Motion** on: the plain list appears and the whole story is readable. Turn it off again.
- [ ] The `curl -I` check above still shows `noindex`.

## Known issues and what only you can check

Everything below was checked in headless Edge against the production build (`out/`) at 360 to 1440 px wide, except where it says otherwise.

**Needs you or your iPhone**

- **Speed and memory on a real iPhone are not measured.** Headless Edge draws in software, so its frame rate says nothing about an iPhone 15. Scroll the whole thing on the phone and tell me where it stutters; adding `?debug` to the address (for your own test only) shows live frames per second, which should stay near 60. iPhone Safari does not let a page read its own memory use, so there is no memory figure: the sign of trouble is the page reloading itself.
- **The real iOS keyboard on the gate is not tested.** The gate follows the visual viewport (tested with a shrunken viewport), but only a real keyboard proves it.
- **Music on an iPhone is not tested**, including the silent switch and the first-tap delay. The code follows what iOS requires (play is called inside the tap), and it plays, pauses and loops in a desktop browser with a test tone.
- **Coming back from another app is tested by forcing the browser to drop the 3D layer, not by really switching apps.** The page asks the browser to give it back, redraws the moment it does, and if it never does (3 seconds with the page visible) it builds a fresh canvas, twice; after that it shows the plain list. Confirm on the phone.
- **The song, the live link and the Netlify upload** need your MP3 and your account.

**Known limits**

- The "Open in Safari" note only appears in apps that announce themselves in their browser's user-agent (Instagram, Facebook, Messenger, TikTok, Snapchat, LINE, WeChat, LinkedIn and Pinterest). Its wording is for an iPhone. WhatsApp, Telegram and iMessage open links in a normal Safari view without a marker, so they get no note (and need none).
- The Song does not start by itself when the gate opens: she taps the Sound button. (The gate's first tap only unlocks the page's audio.) If you would like it to start on the gate's tap, say so; it is a small change.
- The first tap on the Sound button takes a moment to start the music, because the Song is not downloaded until then (it is several MB; downloading it up front would cost her data even if she never taps).
- The plain list (reduced motion or no 3D) shows each Chapter's Day number, and the Anniversary's own day number above the Letter, but has no climbing Day counter or progress line along the top. That was optional.
- The gate is a soft lock: the answers are in the page's code, and `?open` skips it.
- The photos, dates, question and Letter are still the placeholders from the build until you replace them.
