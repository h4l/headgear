export const STORAGE_KEY_IMAGE_CONTROLS = "image-controls";
export const PORT_IMAGE_CONTROLS_CHANGED = "image-controls-changed";

export enum ImageStyleType {
  STANDARD = "standard",
  NFT_CARD = "nft-card",
  NO_BG = "no-background",
  HEADSHOT_HEX = "headshot-hex",
  HEADSHOT_CIRCLE = "headshot-circle",
}

export enum OutputImageFormat {
  SVG = "svg",
  PNG = "png",
}

export enum RasterImageSize {
  SMALL = "sm",
  MEDIUM = "md",
  LARGE = "lg",
  XLARGE = "xl",
  EXACT_WIDTH = "height",
  EXACT_HEIGHT = "width",
}

/** The state of the image controls panel. */
export interface ControlsStateObject {
  imageStyle: ImageStyleType;
  scrollPosition: number;
  imageOptionsUIOpen: boolean;
  outputImageFormat: OutputImageFormat;
  rasterImageExactWidth: number;
  rasterImageExactHeight: number;
  rasterImageSize: RasterImageSize;
}

export const DEFAULT_CONTROLS_STATE: ControlsStateObject = Object.freeze({
  imageStyle: ImageStyleType.STANDARD,
  scrollPosition: 0,
  imageOptionsUIOpen: false,
  outputImageFormat: OutputImageFormat.PNG,
  rasterImageExactWidth: 1000,
  rasterImageExactHeight: 1000,
  rasterImageSize: RasterImageSize.MEDIUM,
});

const _imageStyleTypeValues = Object.freeze(Object.values(ImageStyleType));
const _imageFormats = Object.freeze(Object.values(OutputImageFormat));
const _imageSizes = Object.freeze(Object.values(RasterImageSize));

export function isControlsStateObject(
  obj: unknown
): obj is ControlsStateObject {
  const _obj = obj as Partial<ControlsStateObject>;
  return (
    typeof _obj === "object" &&
    _imageStyleTypeValues.includes(_obj.imageStyle as ImageStyleType) &&
    typeof _obj.scrollPosition === "number" &&
    typeof _obj.imageOptionsUIOpen === "boolean" &&
    _imageFormats.includes(_obj.outputImageFormat as OutputImageFormat) &&
    typeof _obj.rasterImageExactWidth === "number" &&
    typeof _obj.rasterImageExactHeight === "number" &&
    _imageSizes.includes(_obj.rasterImageSize as RasterImageSize)
  );
}
