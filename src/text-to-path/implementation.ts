import { Path, PathCommand } from "opentype.js";

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
  closeSubpaths(path);
  // 2 seems to be a good default. With font sizes ~20-40 units I can't see any
  // visual differences between 2 and 4. There are some minor artefacts with 1.
  return path.toSVG(decimalPlaces ?? 2);
}

/**
 * Ensure each subpath of a Path ends with a close (Z) command.
 *
 * opentype.js only closes glyph contours if the Path has a stroke set:
 * https://github.com/opentypejs/opentype.js/issues/707 We stroke the paths
 * with CSS, so unclosed contours render with gaps in their stroke.
 */
function closeSubpaths(path: Path): void {
  const commands: PathCommand[] = [];
  const closeCurrentSubpath = () => {
    const last = commands[commands.length - 1];
    if (last !== undefined && last.type !== "Z") commands.push({ type: "Z" });
  };
  for (const cmd of path.commands) {
    if (cmd.type === "M") closeCurrentSubpath();
    commands.push(cmd);
  }
  closeCurrentSubpath();
  path.commands = commands;
}
