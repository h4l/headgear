import { getFont } from "./font-loading";
import { TextToPathOptions } from "./interface";

export async function textToPath(options: TextToPathOptions): Promise<string> {
  const { fontUrl, text, x, y, options: _options } = options;
  const fontSize = options.fontSize ?? 72;
  const { decimalPlaces } = options;
  const textAnchor = options.textAnchor ?? "start";
  const font = await getFont(fontUrl);

  let xOffset = 0;
  if (textAnchor !== "start") {
    const width = font.getAdvanceWidth(text, fontSize, _options);
    xOffset = width * (textAnchor === "middle" ? -0.5 : -1);
  }

  const path = font.getPath(
    text,
    (x ?? 0) + xOffset,
    y ?? 0,
    fontSize,
    _options
  );
  // 2 seems to be a good default. With font sizes ~20-40 units I can't see any
  // visual differences between 2 and 4. There are some minor artefacts with 1.
  return path.toSVG(decimalPlaces ?? 2);
}
