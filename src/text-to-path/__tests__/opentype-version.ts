import { readFileSync } from "fs";

// opentype.js is pinned to 1.3.4. Later versions (1.3.5 and 2.x) need code
// changes: they no longer close glyph contours unless the Path has a stroke
// set, which leaves gaps in the stroke of our CSS-stroked text paths
// (https://github.com/opentypejs/opentype.js/issues/707), and they remove
// opentype.load(). The opentype-js-2-compat branch has these changes.
const SUPPORTED_OPENTYPE_VERSION = "1.3.4";

test("opentype.js is the version our text-to-path code supports", () => {
  const { version } = JSON.parse(
    readFileSync(require.resolve("opentype.js/package.json"), "utf-8")
  ) as { version: string };

  if (version !== SUPPORTED_OPENTYPE_VERSION) {
    throw new Error(
      `opentype.js ${version} is installed, but text-to-path only supports ` +
        `${SUPPORTED_OPENTYPE_VERSION}. Newer versions don't close glyph ` +
        `contours (https://github.com/opentypejs/opentype.js/issues/707) ` +
        `and remove opentype.load(). Use the changes on the ` +
        `opentype-js-2-compat branch to update opentype.js.`
    );
  }
});
