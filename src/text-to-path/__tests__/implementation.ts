import { FONT_REDDIT_SANS_BOLD, _internals } from "../../text-to-path";
import { textToPath } from "../implementation";
import { TextAnchor } from "../interface";

jest.mock("../font-loading");

describe("textToPath()", () => {
  test("creates SVG path element with path commands", async () => {
    const pathElStr = await textToPath({
      fontUrl: FONT_REDDIT_SANS_BOLD,
      text: "Hello World!",
    });
    const pathEl = _internals.parseSVGPathFragment(pathElStr);
    expect(pathEl.nodeName).toBe("path");
    expect(pathEl.getAttribute("d")).toBeTruthy();
  });

  test("default option values", async () => {
    const textWithImplicitDefaults = await textToPath({
      fontUrl: FONT_REDDIT_SANS_BOLD,
      text: "Hello World!",
    });
    const textWithExplicitDefaults = await textToPath({
      fontUrl: FONT_REDDIT_SANS_BOLD,
      text: "Hello World!",
      x: 0,
      y: 0,
      fontSize: 72,
      decimalPlaces: 2,
      textAnchor: "start",
      options: {},
    });

    expect(textWithImplicitDefaults).toEqual(textWithExplicitDefaults);
  });

  test("textAnchor option affects x position", async () => {
    const textAt = (options: { x: number; textAnchor?: TextAnchor }) =>
      textToPath({
        fontUrl: FONT_REDDIT_SANS_BOLD,
        text: "■",
        x: options.x,
        textAnchor: options.textAnchor,
        decimalPlaces: 0,
      });

    // These are all equal because they're the same text, but specified with
    // different start points.
    const textFromDefault = await textAt({ x: 100 });
    const textFromStart = await textAt({ x: 100, textAnchor: "start" });
    const textFromMiddle = await textAt({ x: 131, textAnchor: "middle" });
    const textFromEnd = await textAt({ x: 162, textAnchor: "end" });

    expect(textFromStart).toEqual(textFromDefault);
    expect(textFromMiddle).toEqual(textFromDefault);
    expect(textFromEnd).toEqual(textFromDefault);
  });
});
