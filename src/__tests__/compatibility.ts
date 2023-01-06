import {polyfillWebExtensionsAPI} from "../compatibility";

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
