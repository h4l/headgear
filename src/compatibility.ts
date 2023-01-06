// Non-chrome browsers provide the WebExtensions API on the global browser
// property. I'd like to constrain the extension to use only Manifest V3 APIs,
// and Chrome is currently the main supported platform. So I'm supporting
// FireFox by typing the `browser` property as if it contained Chrome APIs.
// Hopefully there's enough consistency with Manifest V3 APIs for this to be OK.
type WebExtensionApi = {
  browser?: typeof globalThis.chrome;
};

export function polyfillWebExtensionsAPI() {
  if (!globalThis.chrome) {
    const browser = (globalThis as WebExtensionApi).browser;
    if (!browser) {
      throw new Error(
        "WebExtensions API not available on `chrome` or `browser` global"
      );
    }
    globalThis.chrome = browser;
  }
}

interface FirefoxInjectionResult<T>
  extends chrome.scripting.InjectionResult<T> {
  error?: unknown;
}

/**
 * Detect and handle errors in an chrome.scripting.executeScript() result array.
 *
 * Firefox doesn't reject the executeScript() promise, rather each element in
 * the returned array can have an error property.
 */
export function throwIfExecuteScriptResultFailed(
  executeScriptResult: chrome.scripting.InjectionResult<unknown>[]
): void {
  for (const result of executeScriptResult as FirefoxInjectionResult<unknown>[]) {
    if (result.error) {
      throw new Error(
        `chrome.scripting.executeScript() failed: ${result.error}`
      );
    }
  }
}
