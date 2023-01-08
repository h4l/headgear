import { mockChrome } from "../../__tests__/chrome.mock";

import * as implementation from "../implementation";
import { TextToPathMessage, TextToPathOptions } from "../interface";
import { registerMessageListener } from "../service";

jest.mock("../implementation", () => ({
  textToPath: jest.fn().mockRejectedValue(new Error("not implemented")),
}));

describe("registerMessageListener()", () => {
  beforeEach(() => {
    window.chrome = mockChrome();
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  const makeOptions: () => TextToPathOptions = () => ({
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
  });

  describe("adds message listener that...", () => {
    test("handles successful requests", async () => {
      jest.mocked(implementation.textToPath).mockResolvedValueOnce("<path />");
      registerMessageListener();
      const message: TextToPathMessage = {
        type: "text-to-path",
        ...makeOptions(),
      };
      const responseMessage: PromiseSettledResult<string> = {
        status: "fulfilled",
        value: "<path />",
      };
      await expect(chrome.runtime.sendMessage(message)).resolves.toEqual(
        responseMessage
      );
      expect(implementation.textToPath).toBeCalledWith(makeOptions());
    });
  });

  test("handles unsuccessful requests", async () => {
    jest
      .mocked(implementation.textToPath)
      .mockRejectedValueOnce(new Error("something's wrong"));
    registerMessageListener();
    const message: TextToPathMessage = {
      type: "text-to-path",
      ...makeOptions(),
    };
    const responseMessage: PromiseSettledResult<string> = {
      status: "rejected",
      reason: "something's wrong",
    };
    await expect(chrome.runtime.sendMessage(message)).resolves.toEqual(
      responseMessage
    );
    expect(implementation.textToPath).toBeCalledWith(makeOptions());
  });
});
