export const STORAGE_KEY_IMAGE_CONTROLS = "image-controls";
export const PORT_IMAGE_CONTROLS_CHANGED = "image-controls-changed";

export enum ImageStyleType {
  STANDARD = "standard",
  BACKGROUND = "background",
  HEADSHOT_HEX = "headshot-hex",
  HEADSHOT_CIRCLE = "headshot-circle",
}

/** The state of the image controls panel. */
export interface ControlsStateObject {
  imageStyle: ImageStyleType;
}

const _imageStyleTypeValues = Object.freeze(Object.values(ImageStyleType));
export function isControlsStateObject(
  obj: unknown
): obj is ControlsStateObject {
  return (
    typeof obj === "object" &&
    _imageStyleTypeValues.includes(
      (obj as Partial<ControlsStateObject>).imageStyle as any
    )
  );
}
