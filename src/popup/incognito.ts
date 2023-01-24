import { Signal, signal } from "@preact/signals";

/**
 * Get a signal that tells whether we're running in an incognito (private)
 * window.
 */
export function getIsIncognitoSignal(): Signal<boolean | undefined> {
  const isIncognitoSignal = signal<boolean | undefined>(undefined);
  (async () => {
    isIncognitoSignal.value = (await chrome.windows.getCurrent()).incognito;
  })();
  return isIncognitoSignal;
}
