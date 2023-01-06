// Defined in webpack config via DefinePlugin
interface HeadgearGlobalObject {
  FEATURE_CANVAS_SVG_ABSOLUTE_DIMENSIONS: boolean;
}

declare const HeadgearGlobal: HeadgearGlobalObject;
