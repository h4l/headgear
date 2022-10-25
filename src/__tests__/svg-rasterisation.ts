import { rasteriseSVG } from "../svg-rasterisation";

test("rasteriseSVG() exists", () => {
  // I don't think it's really practical to test rasteriseSVG() in a jsdom
  // environment.
  expect(typeof rasteriseSVG).toBe("function");
});
