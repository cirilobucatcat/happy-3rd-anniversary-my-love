"use client";

import { useEffect, useState } from "react";
import { isInAppBrowser } from "@/lib/in-app-browser";

/**
 * A small dismissible note on top of everything (the gate included) when the link was opened inside another app's own
 * browser, which is slower and can block the music. A page can't open Safari for her, so it says how.
 */
export default function InAppHint() {
  const [show, setShow] = useState(false);
  // The user agent is only known in the browser, so this is decided after mount (the server renders nothing).
  useEffect(() => setShow(isInAppBrowser(navigator.userAgent)), []);

  if (!show) return null;
  return (
    <aside className="hint" role="note">
      <p className="hint-text">
        <strong>Open in Safari for the best experience.</strong> Tap the menu (&hellip; or the compass) and choose &ldquo;Open in Safari&rdquo;.
      </p>
      <button type="button" className="hint-close" aria-label="Dismiss" onClick={() => setShow(false)}>
        &times;
      </button>
    </aside>
  );
}
