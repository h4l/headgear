import { HeadgearGlobalObject } from "../headgear-global";

/**
 * Create globals from webpack-defines.d.ts on globalThis.
 */
export function mockWebpackDefines(): HeadgearGlobalObject {
  const HeadgearGlobal: HeadgearGlobalObject = {
    FEATURE_CANVAS_SVG_ABSOLUTE_DIMENSIONS: false,
    HEADGEAR_BUILD: {
      browserTarget: "chrome",
      mode: "development",
      version: "1.2.3",
    },
  };
  (
    globalThis as unknown as { HeadgearGlobal: HeadgearGlobalObject }
  ).HeadgearGlobal = HeadgearGlobal;
  return HeadgearGlobal;
}
