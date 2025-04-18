import { Signal, signal } from "@preact/signals";
import { PostHog } from "posthog-js";
import { createContext } from "preact";

import { ResolvedAvatar } from "../avatars";
import {
  ControlsStateObject,
  OutputImageFormat,
} from "../popup-state-persistence";

export enum AvatarDataErrorType {
  UNKNOWN,
  NOT_REDDIT_TAB,
  GET_AVATAR_FAILED,
  USER_HAS_NO_AVATAR,
  AUTH_TOKEN_NOT_AVAILABLE,
}
export type AvatarDataError =
  | { type: AvatarDataErrorType.UNKNOWN; exception: Error }
  | { type: AvatarDataErrorType.AUTH_TOKEN_NOT_AVAILABLE; message: string }
  | { type: AvatarDataErrorType.GET_AVATAR_FAILED; message: string }
  | {
      type: AvatarDataErrorType.NOT_REDDIT_TAB;
      tab: chrome.tabs.Tab;
    }
  | { type: AvatarDataErrorType.USER_HAS_NO_AVATAR };

export enum DataStateType {
  BEFORE_LOAD,
  LOADING,
  ERROR,
  LOADED,
}

/**
 * The state of Avatar data (obtained from the Reddit tab we're associated
 * with).
 */
export type AvatarDataState =
  | { type: DataStateType.BEFORE_LOAD }
  | { type: DataStateType.LOADING }
  | { type: DataStateType.ERROR; error: AvatarDataError }
  | {
      type: DataStateType.LOADED;
      tab: chrome.tabs.Tab;
      avatar: ResolvedAvatar;
    };

/**
 * The Avatar SVG image (serialised as an XML string), created from the Avatar
 * data, depending on the UI controls state. `undefined` while data or UI
 * controls are loading, or if an error occurs.
 */
export type AvatarSVGState = Error | SVGElement | undefined;

export interface OutputImage {
  format: OutputImageFormat;
  blob: Blob;
  url: string;
  mimeType: string;
}
export type OutputImageState = Error | OutputImage | undefined;

// undefined while loading from storage
export type ControlsState = undefined | ControlsStateObject;

export type AnalyticsState = PostHog | undefined;

export interface RootState {
  avatarDataState: Signal<AvatarDataState>;
  avatarSvgState: Signal<AvatarSVGState>;
  outputImageState: Signal<OutputImageState>;
  controlsState: Signal<ControlsState>;
}

export const AvatarDataContext = createContext<Signal<AvatarDataState>>(
  signal({ type: DataStateType.BEFORE_LOAD })
);
export const ControlsContext = createContext<Signal<ControlsState>>(
  signal(undefined)
);
export const AvatarSvgContext = createContext<Signal<AvatarSVGState>>(
  signal(undefined)
);
export const OutputImageContext = createContext<Signal<OutputImageState>>(
  signal(undefined)
);
export const AnalyticsContext = createContext<Signal<AnalyticsState>>(
  signal(undefined)
);
