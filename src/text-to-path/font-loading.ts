import opentype, { Font } from "opentype.js";

const fonts: Map<string, Promise<Font>> = new Map();

export function getFont(fontUrl: string): Promise<Font> {
  let fontPromise = fonts.get(fontUrl);
  if (fontPromise !== undefined) return fontPromise;
  fontPromise = opentype.load(fontUrl);
  fonts.set(fontUrl, fontPromise);
  return fontPromise;
}
