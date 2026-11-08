/**
 * The Unlock question's soft lock. It keeps a surprise from being opened by accident; it is not real security (the
 * answers sit in the page's own code), so the matching is deliberately forgiving.
 */

/** Lower case, accents removed, and everything but letters and digits dropped, so spaces, punctuation and case never matter. */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** True if `input` matches any accepted spelling. An empty answer never matches. */
export function isRightAnswer(input: string, accepted: readonly string[]): boolean {
  const given = normalizeAnswer(input);
  if (!given) return false;
  return accepted.some((answer) => normalizeAnswer(answer) === given);
}

/** Used only if the Creator lists no messages. Kind, and (a test checks) never the answer. */
const FALLBACK = "Not quite. Have another try.";

/** The kind message for the `attempt`-th wrong answer (1 for the first): they run in order, then start over. */
export function wrongAnswerMessage(attempt: number, messages: readonly string[]): string {
  if (messages.length === 0) return FALLBACK;
  const i = (Math.max(1, Math.floor(attempt)) - 1) % messages.length;
  return messages[i];
}
