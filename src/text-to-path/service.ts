/**
 * This module is a stand-alone service that provides text to SVG path rendering
 * for Headgear's SVG images.
 *
 * It's implemented as a separate service in order to maintain a clear boundary
 * between this portion of the codebase and the rest. The reason for that is
 * that we use opentype.js for text to path rendering, and this library is
 * massive (—0.5MB of js) and I want the code to remain auditable. Bundling so
 * much code into the main part of the app goes against that goal.
 *
 * This service runs in a separate iframe from the rest of Headgear, and uses
 * message passing to communicate text/path data.
 */
import { textToPath } from "./implementation";
import { isTextToPathMessage } from "./interface";

function stringifyError(reason: unknown): string {
  return reason instanceof Error ? reason.message : `${reason}`;
}

async function asSerialisableSettledPromise<T>(
  promise: Promise<T>
): Promise<PromiseSettledResult<T>> {
  const result = (await Promise.allSettled([promise]))[0];
  if (result.status === "rejected") {
    result.reason = stringifyError(result.reason);
  }
  return result;
}

export function registerMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isTextToPathMessage(message)) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type: _, ...options } = message;
    asSerialisableSettledPromise(textToPath(options)).then(sendResponse);
    return true;
  });
}
