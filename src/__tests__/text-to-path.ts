import { mockChrome } from "./chrome.mock";

import { SVGNS } from "../svg";
import { _internals, textToPath } from "../text-to-path";
import {
  MESSAGE_TEXT_TO_PATH,
  TextToPathOptions,
} from "../text-to-path/interface";

describe("textToPath()", () => {
  beforeEach(() => {
    window.chrome = mockChrome();
  });
  afterEach(() => {
    jest.resetAllMocks();
  });
  test("sends messages to service", async () => {
    const messageResponse: PromiseFulfilledResult<string> = {
      status: "fulfilled",
      value: '<path d="M 0,0 h 5 v 5 z"/>',
    };
    jest
      .mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce(messageResponse);
    const options: TextToPathOptions = {
      fontUrl: "/foo.woff",
      text: "Hi",
      decimalPlaces: 1,
      fontSize: 42,
      textAnchor: "middle",
      x: 12,
      y: 31,
      options: {
        features: { foo: true },
        kerning: true,
        language: "abc",
        letterSpacing: 0.5,
        script: "def",
        tracking: 3,
        xScale: 0.8,
        yScale: 1.2,
      },
    };
    const response = await textToPath(options);
    expect(chrome.runtime.sendMessage).toBeCalledWith({
      type: MESSAGE_TEXT_TO_PATH,
      ...options,
    });
    expect(response).toMatchInlineSnapshot(`
      <path
        d="M 0,0 h 5 v 5 z"
      />
    `);
  });
  test("rejects invalid message response", async () => {
    jest
      .mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce({ unexpected: "blah" });
    await expect(() =>
      textToPath({ fontUrl: "/foo.woff", text: "Hi" })
    ).rejects.toThrow("unexpected response");
  });
  test("reports failed requests", async () => {
    const responseMessage: PromiseRejectedResult = {
      status: "rejected",
      reason: new Error("things broke"),
    };
    jest
      .mocked(chrome.runtime.sendMessage)
      .mockResolvedValueOnce(responseMessage);
    await expect(() =>
      textToPath({ fontUrl: "/foo.woff", text: "Hi" })
    ).rejects.toThrow("Failed to generate path from text: Error: things broke");
  });
});

describe("internals", () => {
  describe("parseSVGPathFragment()", () => {
    test("rejects non-path XML", () => {
      expect(() => _internals.parseSVGPathFragment("<foo/>")).toThrow(
        "failed to parse text-to-path SVG Path output"
      );
    });
    test("paths are proper, SVG-namespaced elements", () => {
      const pathEl = _internals.parseSVGPathFragment(
        '<path d="M 0,0 h 5 v 5 z"/>'
      );
      expect(pathEl).toBeInstanceOf(SVGElement);
      expect(pathEl.tagName).toBe("path");
      expect(pathEl.namespaceURI).toBe(SVGNS);
      expect(pathEl).toMatchInlineSnapshot(`
        <path
          d="M 0,0 h 5 v 5 z"
        />
      `);
    });
  });
});
