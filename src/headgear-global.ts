export interface HeadgearGlobalObject {
  FEATURE_CANVAS_SVG_ABSOLUTE_DIMENSIONS: boolean;
  HEADGEAR_BUILD: {
    version: string;
    browserTarget: "chrome" | "firefox";
    mode: "development" | "production";
  };
}
