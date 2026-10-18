import { Font, parse } from "opentype.js";

const fonts: Map<string, Promise<Font>> = new Map();

async function loadFont(fontUrl: string): Promise<Font> {
  const response = await fetch(fontUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to load font ${fontUrl}: ${response.status} ${response.statusText}`
    );
  }
  return parse(await response.arrayBuffer());
}

export function getFont(fontUrl: string): Promise<Font> {
  let fontPromise = fonts.get(fontUrl);
  if (fontPromise !== undefined) return fontPromise;
  fontPromise = loadFont(fontUrl);
  fonts.set(fontUrl, fontPromise);
  return fontPromise;
}
