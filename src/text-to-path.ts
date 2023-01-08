import { SVGNS, parseSVG } from "./svg";
import {
  MESSAGE_TEXT_TO_PATH,
  TextToPathMessage,
  TextToPathOptions,
  isValidResponse,
} from "./text-to-path/interface";

export const FONT_REDDIT_SANS_BOLD = `/font/name=reddit-sans,font-weight=bold,font-style=normal.woff`;
export const FONT_REDDIT_SANS_EXTRABOLD = `/font/name=reddit-sans,font-weight=800,font-style=normal.woff`;

export async function textToPath(
  options: TextToPathOptions
): Promise<SVGPathElement> {
  const response = await chrome.runtime.sendMessage<TextToPathMessage, unknown>(
    {
      type: MESSAGE_TEXT_TO_PATH,
      ...options,
    }
  );
  if (!isValidResponse(response)) throw new TypeError("unexpected response");
  if (response.status === "fulfilled")
    return parseSVGPathFragment(response.value);
  throw new Error(`Failed to generate path from text: ${response.reason}`);
}

function parseSVGPathFragment(pathFragment: string): SVGPathElement {
  const path = parseSVG({
    svgSource: pathFragment.replace(/^<path\s/, `<path xmlns="${SVGNS}" `),
    parseErrorMessage: "failed to parse text-to-path SVG Path output",
    rootElement: "path",
  }) as SVGPathElement;
  // remove the explicit namespace attribute, otherwise all the serialised path
  // nodes will include it, despite it being redundant.
  path.removeAttribute("xmlns");
  return path;
}

export const _internals = {
  parseSVGPathFragment,
};
