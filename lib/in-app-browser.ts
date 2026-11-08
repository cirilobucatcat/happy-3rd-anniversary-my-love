/**
 * In-app browser detection. The link will be sent through a chat or social app, and some of those open it in their own
 * cut-down browser (slower, no reliable audio, odd toolbars). Safari is the one the site is built and tested for, so
 * those get an "Open in Safari" hint. Apps that open links in a real Safari view with no marker (WhatsApp, Telegram,
 * iMessage) cannot be told apart from Safari and are treated as Safari.
 */

/** The user-agent marker each in-app browser adds. */
const IN_APP_MARKERS: readonly RegExp[] = [
  /Instagram/i,
  /\bFB(?:AN|AV|_IAB)\b/, // Facebook and Messenger
  /musical_ly|BytedanceWebview|TikTok/i,
  /Snapchat/i,
  /\bLine\/\d/, // LINE
  /MicroMessenger/i, // WeChat
  /LinkedInApp/i,
  /\[Pinterest\//i,
];

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_MARKERS.some((marker) => marker.test(userAgent));
}
