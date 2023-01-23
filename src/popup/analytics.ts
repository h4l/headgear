import { ResolvedAvatar } from "../avatars";
import {
  ControlsStateObject,
  OutputImageFormat,
  RasterImageSize,
} from "../popup-state-persistence";

export function getAvatarEventProperties(
  avatar: ResolvedAvatar
): Record<string, unknown> {
  return avatar.nftInfo?.nftId ? { nftId: avatar.nftInfo.nftId } : {};
}

export function getImageEventProperties(
  controlsState: ControlsStateObject
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  props.imageStyle = controlsState.imageStyle;
  props.outputImageFormat = controlsState.outputImageFormat;

  if (controlsState.outputImageFormat === OutputImageFormat.PNG) {
    props.rasterImageSize = controlsState.rasterImageSize;
    if (controlsState.rasterImageSize === RasterImageSize.EXACT_HEIGHT) {
      props.rasterImageExactHeight = controlsState.rasterImageExactHeight;
    } else if (controlsState.rasterImageSize === RasterImageSize.EXACT_WIDTH) {
      props.rasterImageExactWidth = controlsState.rasterImageExactWidth;
    }
  }
  return props;
}
