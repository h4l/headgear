import { textToPath } from "../text-to-path/implementation";
import { TextToPathOptions } from "../text-to-path/interface";

const actual = jest.requireActual("../text-to-path");
const _internals = actual._internals;

module.exports = {
  ...actual,
  // Mock textToPath with a fully-working implementation that directly calls
  // the implementation, instead of using message passing, as the sandboxed
  // browser implementation does.
  async textToPath(options: TextToPathOptions): Promise<SVGPathElement> {
    return _internals.parseSVGPathFragment(await textToPath(options));
  },
};
