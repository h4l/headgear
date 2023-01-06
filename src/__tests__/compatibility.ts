import {
  polyfillWebExtensionsAPI,
  throwIfExecuteScriptResultFailed,
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
