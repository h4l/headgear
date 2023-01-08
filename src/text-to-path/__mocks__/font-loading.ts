import opentype, { Font } from "opentype.js";
import * as path from "path";

import { assert } from "../../assert";

export async function getFont(fontUrl: string): Promise<Font> {
  assert(fontUrl.startsWith("/font/"));
  const localFontPath = path.resolve(__dirname, "../../", fontUrl.substring(1));
  const font = opentype.loadSync(localFontPath);
  // This mock should be async, like the real implementation
  return Promise.resolve().then(() => font);
}
