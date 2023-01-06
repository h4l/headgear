import { assert } from "../assert";
import {
  polyfillWebExtensionsAPI,
  throwIfExecuteScriptResultFailed,
  writeImageToClipboard,
} from "../compatibility";

describe("polyfillWebExtensionsAPI()", () => {
  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
    delete (globalThis as { browser?: unknown }).browser;
  });

  test("does nothing if chrome is defined", () => {
    const chrome = {};
    (globalThis as { chrome?: unknown }).chrome = chrome;
    polyfillWebExtensionsAPI();
    expect(globalThis.chrome).toBe(chrome);
  });

  test("copies browser to chrome is chrome is not defined", () => {
    const browser = {};
    (globalThis as { browser?: unknown }).browser = browser;
    polyfillWebExtensionsAPI();
    expect(globalThis.chrome).toBe(browser);
  });
});

describe("throwIfExecuteScriptResultFailed()", () => {
  test("does not throw for successful results", () => {
    expect(() =>
      throwIfExecuteScriptResultFailed([{ frameId: 123, result: undefined }])
    ).not.toThrow();
  });

  test("throws if result has an error", () => {
    const errorResult: chrome.scripting.InjectionResult<unknown> & {
      error: unknown;
    } = {
      frameId: 123,
      result: undefined,
      error: "Example error",
    };
    expect(() => {
      throwIfExecuteScriptResultFailed([errorResult]);
    }).toThrowError("chrome.scripting.executeScript() failed: Example error");
  });
});

type Writable<T> = {
  -readonly [P in keyof T]: T[P];
};

type Deletable<T> = Writable<Partial<T>>;

describe("writeImageToClipboard()", () => {
  class MockClipboardItem implements ClipboardItem {
    get types(): readonly string[] {
      throw new Error("Method not implemented.");
    }
    getType(): Promise<Blob> {
      throw new Error("Method not implemented.");
    }
  }
  beforeEach(() => {
    assert(globalThis.ClipboardItem === undefined);
    assert(globalThis.navigator !== undefined);
    assert(globalThis.navigator.clipboard === undefined);
    assert((globalThis as Record<string, unknown>).browser === undefined);
  });

  afterEach(() => {
    delete (globalThis.navigator as Deletable<Navigator>).clipboard;
    delete (globalThis as Deletable<typeof globalThis>).ClipboardItem;
    delete (globalThis as Record<string, unknown>).browser;
  });

  test("browsers supporting ClipboardItem use navigator.clipboard.write", async () => {
    // Chrome supports the standard ClipboardItem API to write to the clipboard
    (globalThis as Writable<typeof globalThis>).ClipboardItem =
      MockClipboardItem;
    const mockClipboard: Partial<Clipboard> = {
      write: jest.fn(),
    };
    (globalThis.navigator as Writable<Navigator>).clipboard =
      mockClipboard as Clipboard;

    const imageBlob = new Blob(["PNG"], { type: "image/png" });
    await writeImageToClipboard(imageBlob);

    expect(globalThis.navigator.clipboard.write).toBeCalledTimes(1);
    expect(globalThis.navigator.clipboard.write).toBeCalledWith([
      new ClipboardItem({ "image/png": imageBlob }),
    ]);
  });

  test("Browsers without ClipboardItem use browser.clipboard.setImageData", async () => {
    // Firefox doesn't support ClipboardItem, it provides a non-standard
    // browser.clipboard.setImageData API.
    const setImageData = jest.fn();
    (globalThis as Record<string, unknown>).browser = {
      clipboard: { setImageData },
    };

    const imageBlob = new Blob(["PNG"], { type: "image/png" });
    assert(imageBlob.arrayBuffer === undefined);
    const imageBlobAsArrayBuffer = { "mock-array-buffer-of": imageBlob };
    imageBlob.arrayBuffer = jest.fn().mockResolvedValue(imageBlobAsArrayBuffer);

    await writeImageToClipboard(imageBlob);

    expect(setImageData).toBeCalledTimes(1);
    expect(setImageData).toBeCalledWith(await imageBlob.arrayBuffer(), "png");
  });

  test("Browsers without either fail with an error", async () => {
    const imageBlob = new Blob(["PNG"], { type: "image/png" });
    await expect(writeImageToClipboard(imageBlob)).rejects.toThrow(
      "Unable to copy image, no supported clipboard API available"
    );
  });
});
