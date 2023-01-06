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
