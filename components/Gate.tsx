"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import WriteOnText from "@/components/WriteOnText";
import { GATE } from "@/content/memories";
import { unlockAudio } from "@/lib/audio";
import { isRightAnswer, wrongAnswerMessage } from "@/lib/gate";

type Props = {
  /** The right answer was given: the gate fades away into the Sky. */
  opening: boolean;
  onUnlock: () => void;
};

/**
 * The Unlock question: a full-screen pink gate that hides the site and keeps it from scrolling until the Recipient
 * answers. A soft lock for a surprise, not security. Wrong answers get a kind message that never gives the answer
 * away. The first tap anywhere here also unlocks audio, which iPhone Safari only allows after a tap (a click, not a
 * pointer-down, is what it counts).
 */
export default function Gate({ opening, onUnlock }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState("");

  // On an iPhone the on-screen keyboard shrinks the *visual* viewport but not the layout one, which would leave the
  // field under the keyboard. Follow the visual viewport so the gate always fits what she can actually see. This is
  // the screen following the keyboard, not the story's scrolling, so it is not a second scroll source (the page cannot
  // scroll while the gate is up); the listeners are removed as soon as the gate goes.
  useEffect(() => {
    const el = root.current;
    const viewport = window.visualViewport;
    if (!el || !viewport) return;
    const sync = () => {
      el.style.setProperty("--gate-height", `${viewport.height}px`);
      el.style.setProperty("--gate-top", `${viewport.offsetTop}px`);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);

  // Close the keyboard as the gate fades, so the Sky is not left half covered.
  useEffect(() => {
    if (opening && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, [opening]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (opening) return;
    unlockAudio(); // a tap or Return key press: the one moment iOS allows it
    if (!value.trim()) {
      setMessage(GATE.emptyMessage);
      return;
    }
    if (isRightAnswer(value, GATE.answers)) {
      setMessage("");
      onUnlock();
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    setMessage(wrongAnswerMessage(next, GATE.wrongMessages));
  };

  return (
    <div
      ref={root}
      className={`gate${opening ? " gate--opening" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      onClick={unlockAudio}
    >
      {/* Alternating class names restart the little nudge on every wrong answer. */}
      <form className={`gate-card${attempts ? ` gate-card--nudge-${attempts % 2}` : ""}`} onSubmit={submit} noValidate>
        <h1 id="gate-title" className="gate-title">
          <WriteOnText text={GATE.title} />
        </h1>
        <label htmlFor="gate-answer" className="gate-question">
          {GATE.question}
        </label>
        <div className="gate-row">
          <input
            id="gate-answer"
            className="gate-input"
            type="text"
            value={value}
            placeholder={GATE.placeholder}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-describedby="gate-message"
          />
          <button className="gate-button" type="submit">
            {GATE.button}
          </button>
        </div>
        <p id="gate-message" className="gate-message" role="status" aria-live="polite">
          {message}
        </p>
      </form>
    </div>
  );
}
