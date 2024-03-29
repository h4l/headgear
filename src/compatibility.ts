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

interface FirefoxWebExtensionsApi {
  clipboard: {
    setImageData(
      imageData: ArrayBuffer,
      imageType: "png" | "jpeg"
    ): Promise<void>;
  };
}

function isFirefoxWebExtensionsApi(
  object: unknown
): object is FirefoxWebExtensionsApi {
  return (
    typeof object === "object" &&
    typeof (object as Partial<FirefoxWebExtensionsApi>).clipboard
      ?.setImageData === "function"
  );
}

export async function writeImageToClipboard(imageBlob: Blob): Promise<void> {
  if (globalThis.ClipboardItem) {
    return await navigator.clipboard.write([
      new ClipboardItem({ [imageBlob.type]: imageBlob }),
    ]);
  }

  const browser = (globalThis as WebExtensionApi).browser;
  if (isFirefoxWebExtensionsApi(browser)) {
    // Firefox hasn't implemented navigator.clipboard.write for images...
    if (imageBlob.type !== "image/png") {
      throw new Error(`Unable to copy non-png image: ${imageBlob.type}`);
    }

    return await browser.clipboard.setImageData(
      await imageBlob.arrayBuffer(),
      "png"
    );
  }

  throw new Error("Unable to copy image, no supported clipboard API available");
}
