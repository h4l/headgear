import { Signal, computed, effect, signal, useSignal } from "@preact/signals";
import debounce from "lodash.debounce";
import memoizeOne from "memoize-one";
import { ComponentChildren, Fragment, JSX, createContext } from "preact";
import {
  useContext,
  useEffect,
  useErrorBoundary,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "preact/hooks";

import { assert, assertNever } from "./assert";
import { ResolvedAvatar } from "./avatars";
import {
  ControlsStateObject,
  DEFAULT_CONTROLS_STATE,
  ImageStyleType,
  OutputImageFormat,
  PORT_IMAGE_CONTROLS_CHANGED,
  RasterImageSize,
  STORAGE_KEY_IMAGE_CONTROLS,
  isControlsStateObject,
} from "./popup-state-persistence";
import { GetAvatarMessageResponse, MSG_GET_AVATAR } from "./reddit-interaction";
import {
  NFTCardVariant,
  composeAvatarSVG,
  createHeadshotCircleAvatarSVG,
  createHeadshotCommentsAvatarSVG,
  createNFTCardAvatarSVG,
  createStandardAvatarSVG,
} from "./svg";

const HEADGEAR_ADDRESS = "0xcF4CbFd13BCAc9E30d4fd666BD8d2a81536C01d5";

export enum AvatarDataErrorType {
  UNKNOWN,
  NOT_REDDIT_TAB,
  GET_AVATAR_FAILED,
  USER_HAS_NO_AVATAR,
}
export type AvatarDataError =
  | { type: AvatarDataErrorType.UNKNOWN; exception: Error }
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
export type AvatarSVGState = Error | string | undefined;

// undefined while loading from storage
export type ControlsState = undefined | ControlsStateObject;

export interface RootState {
  avatarDataState: Signal<AvatarDataState>;
  avatarSvgState: Signal<AvatarSVGState>;
  controlsState: Signal<ControlsState>;
}

class GetAvatarError extends Error {}

export const AvatarDataContext = createContext<Signal<AvatarDataState>>(
  signal({ type: DataStateType.BEFORE_LOAD })
);
export const ControlsContext = createContext<Signal<ControlsState>>(
  signal(undefined)
);
export const AvatarSvgContext = createContext<Signal<AvatarSVGState>>(
  signal(undefined)
);

const iconArrowDown = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-7 h-7 inline m-1"
    style="filter: drop-shadow(0px 0px 3px rgb(0 0 0 / 0.3));"
  >
    <path
      fillRule="evenodd"
      d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z"
      clipRule="evenodd"
    />
  </svg>
);

const iconCross = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-6 h-6"
  >
    <path
      fillRule="evenodd"
      d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * cog-6-tooth Solid
 * https://heroicons.com/
 */
function IconCog6(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      class={props.class || "w-6 h-6"}
    >
      <path
        fill-rule="evenodd"
        d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z"
        clip-rule="evenodd"
      />
    </svg>
  );
}

const BUTTON_STYLES = (
  <div
    class={`\
rounded-lg border cursor-pointer
bg-white text-gray-900  border-gray-200
dark:bg-gray-700 dark:text-slate-50 dark:border-gray-600
hover:bg-gray-100 hover:text-blue-700
dark:hover:bg-gray-600 dark:hover:text-white
active:z-10 active:ring-2 active:ring-blue-700 active:text-blue-700
dark:active:ring-blue-300 dark:active:text-blue-200
  disabled:cursor-not-allowed disabled:text-gray-500 disabled:active:ring-0 disabled:active:text-gray-500
  disabled:hover:text-gray-500
  peer-disabled:cursor-not-allowed peer-disabled:text-gray-500 peer-disabled:active:ring-0 peer-disabled:active:text-gray-500
  peer-disabled:hover:text-gray-500
`}
  />
).props.class;

export function ImageStyleOption(props: {
  name: ImageStyleType;
  title: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const avatarDataState = useContext(AvatarDataContext);
  const controlsState = useContext(ControlsContext);

  const setImageStyle = () => {
    if (!controlsState.value) return;
    controlsState.value = { ...controlsState.value, imageStyle: props.name };
  };

  const controlsDisabled =
    props.disabled ||
    avatarDataState.value.type !== DataStateType.LOADED ||
    // controlsState is undefined while loading from storage
    controlsState.value === undefined;
  const disabledReason = props.disabledReason;

  return (
    <div class="group relative">
      <input
        type="radio"
        disabled={props.disabled || controlsDisabled}
        id={`image-style-${props.name}`}
        name="image-style"
        value={props.name}
        checked={
          !controlsDisabled && controlsState.value?.imageStyle === props.name
        }
        onClick={props.disabled ? undefined : setImageStyle}
        class="sr-only peer"
        required
      />
      <label
        class={`
          flex flex-col my-2 p-5
          peer-checked:text-blue-600 peer-checked:border-blue-600
          dark:peer-checked:text-blue-300 dark:peer-checked:border-blue-400
          ${BUTTON_STYLES}

        `}
        for={`image-style-${props.name}`}
      >
        <div class="font-medium">{props.title}</div>
        <p class="text-xs font-normal">{props.description}</p>
      </label>
      {controlsDisabled && disabledReason && (
        <div
          role="tooltip"
          class="inline-block absolute top-4 left-4 cursor-not-allowed _invisible z-10 py-2 px-3 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 dark:bg-gray-700"
        >
          {disabledReason}
        </div>
      )}
    </div>
  );
}

export function CouldNotLoadAvatarMessage(props: {
  title: string;
  logErrorContextMessage?: string;
  logError?: Error | string;
  children: ComponentChildren;
}): JSX.Element {
  useEffect(() => {
    if (props.logError) {
      console.error(
        "Headgear hit an error: ",
        ...[
          props.logErrorContextMessage,
          props.logError,
          props.logError instanceof Error ? props.logError.stack : undefined,
        ].filter((x) => x)
      );
    }
  }, [props.logError, props.logErrorContextMessage]);

  return (
    <div
      data-testid="error"
      class="h-full w-full p-16 bg-white text-gray-800 prose"
    >
      <svg class="w-1/4" viewBox="0 0 100 100">
        <use href="../img/avatar-loading-error.svg#root" />
      </svg>
      <h2 class="_font-bold _text-lg _my-6 mt-8">{props.title}</h2>
      {props.children}
    </div>
  );
}

export function AvatarDataError({
  error,
}: {
  error: AvatarDataError;
}): JSX.Element {
  if (error.type === AvatarDataErrorType.NOT_REDDIT_TAB) {
    return (
      <CouldNotLoadAvatarMessage title="Open a Reddit tab to see your Avatar">
        <p>Headgear needs a Reddit tab open to load your Avatar.</p>
      </CouldNotLoadAvatarMessage>
    );
  } else if (error.type === AvatarDataErrorType.USER_HAS_NO_AVATAR) {
    return (
      <CouldNotLoadAvatarMessage title="Your Reddit account has no Avatar">
        <p>
          Headgear could not load your Avatar because your Reddit account has no
          Avatar.
        </p>
        <p>
          Go and use the{" "}
          <a
            href="https://reddit.zendesk.com/hc/en-us/articles/360043035352-How-do-I-customize-and-style-my-avatar-"
            target="_blank"
            rel="noreferrer"
          >
            Reddit Avatar Builder
          </a>
          , make yourself an Avatar, then come back.
        </p>
      </CouldNotLoadAvatarMessage>
    );
  } else if (error.type === AvatarDataErrorType.GET_AVATAR_FAILED) {
    return (
      <CouldNotLoadAvatarMessage
        title="Something went wrong"
        logErrorContextMessage="Reddit-side Avatar Data fetcher reported failure: "
        logError={error.message}
      >
        <p>
          Headgear could not load your Avatar because it was not able to get the
          data it needs from Reddit. This is probably a temporary problem.
        </p>
        <p>
          If Reddit is working and this keeps happening, there could be
          something wrong with Headgear. Let{" "}
          <a
            href="https://www.reddit.com/user/h4l"
            target="_blank"
            rel="noreferrer"
          >
            /u/h4l
          </a>{" "}
          know about this if it keeps happening.
        </p>
      </CouldNotLoadAvatarMessage>
    );
  } else if (error.type === AvatarDataErrorType.UNKNOWN) {
    return (
      <CouldNotLoadAvatarMessage
        title="Something went wrong"
        logErrorContextMessage="UI-side Avatar Data fetcher reported failure: "
        logError={error.exception}
      >
        <p>
          Headgear could not load your Avatar because an unexpected error
          happened while getting Avatar data from Reddit.
        </p>
        <RequestBugReport />
      </CouldNotLoadAvatarMessage>
    );
  }
  assertNever(error);
}

function RequestBugReport() {
  return (
    <p>
      This probably means you found a bug in Headgear that needs fixing. If you
      could let{" "}
      <a
        href="https://www.reddit.com/user/h4l"
        target="_blank"
        rel="noreferrer"
      >
        /u/h4l
      </a>{" "}
      know about this, they should be able to fix it. Sorry!
    </p>
  );
}

export function AvatarSVG({ svg }: { svg: string }) {
  return (
    <svg
      data-testid="avatar"
      class="object-contain w-full h-full drop-shadow-xl animate-fade-in"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function DisplayArea() {
  const avatarDataState = useContext(AvatarDataContext);
  const controlsState = useContext(ControlsContext);
  const avatarSvgState = useContext(AvatarSvgContext);

  let content: JSX.Element;
  if (avatarDataState.value.type === DataStateType.ERROR) {
    content = <AvatarDataError error={avatarDataState.value.error} />;
  } else if (avatarSvgState.value instanceof Error) {
    content = (
      <CouldNotLoadAvatarMessage
        title="Something went wrong"
        logErrorContextMessage="Failed to generate Avatar SVG: "
        logError={avatarSvgState.value}
      >
        <p>
          Headgear could not load your Avatar because it was not able to
          generate an SVG image from Reddit's Avatar data.
        </p>
        <RequestBugReport />
      </CouldNotLoadAvatarMessage>
    );
  } else if (
    avatarDataState.value.type === DataStateType.BEFORE_LOAD ||
    avatarDataState.value.type === DataStateType.LOADING ||
    controlsState.value === undefined ||
    avatarSvgState.value === undefined
  ) {
    content = (
      <svg
        role="progressbar"
        class="h-full w-full p-28 animate-pulse bg-white text-gray-200 opacity-0 animate-delayed-fade-in"
        style="animation-delay: 250ms;"
        viewBox="0 0 57.520256 100.00005"
      >
        <use href="../img/avatar-loading-skeleton_minimal.svg#skeleton" />
      </svg>
    );
  } else if (avatarDataState.value.type === DataStateType.LOADED) {
    content = <AvatarSVG svg={avatarSvgState.value} />;
  } else {
    assertNever(avatarDataState.value);
  }

  return (
    <div class="grow _bg-slate-700 _bg-gradient-to-br bg-gradient-radial from-slate-600 to-slate-800 p-6">
      {content}
    </div>
  );
}

export function Controls() {
  const avatarDataState = useContext(AvatarDataContext);
  const controlsState = useContext(ControlsContext);

  const [scrollPosNeedsRestore, setScrollPosNeedsRestore] = useState(
    controlsState.value === undefined
  );
  const scrollContainer = useRef<HTMLDivElement>(null);
  const [updateScrollPosition] = useState(() => {
    const updateScrollPositionDebounced = debounce(
      (scrollPosition: number) => {
        if (controlsState.value === undefined) return;
        controlsState.value = { ...controlsState.value, scrollPosition };
      },
      150,
      { trailing: true }
    );
    return (scrollPosition: number) => {
      // don't restore scroll pos after a scroll has already occurred
      if (scrollPosNeedsRestore) setScrollPosNeedsRestore(false);
      updateScrollPositionDebounced(scrollPosition);
    };
  });

  useEffect(() => {
    if (
      scrollContainer.current &&
      scrollPosNeedsRestore &&
      controlsState.value !== undefined
    ) {
      setScrollPosNeedsRestore(false);
      scrollContainer.current.scrollTop =
        controlsState.value.scrollPosition || 0;
    }
  }, [scrollPosNeedsRestore, controlsState.value]);

  let nftOptionsDisabled = false;
  let nftOptionsDisabledReason: string | undefined;
  if (
    avatarDataState.value.type === DataStateType.LOADED &&
    !avatarDataState.value.avatar.nftInfo
  ) {
    nftOptionsDisabled = true;
    nftOptionsDisabledReason = "Only for NFT avatars";
  }

  return (
    <div class="grow-0 shrink-0 basis-[350px] h-full flex flex-col bg-neutral-100 text-gray-900 dark:bg-gray-800 dark:text-slate-50">
      <div class="px-4 flex my-4">
        <img class="ml-auto w-14 mb-1 mr-3" src="../img/logo.svg" />
        <div class="mr-auto flex-shrink">
          <h1 class="text-3xl font-bold">Headgear</h1>
          <p class="text-xs">Unleash your Reddit Avatar.</p>
        </div>
      </div>

      <div
        onScroll={(e) => {
          updateScrollPosition(e.currentTarget.scrollTop);
        }}
        ref={scrollContainer}
        class="border border-gray-300 dark:border-gray-600 border-l-0 border-r-0 flex-grow overflow-y-scroll pl-4 pr-4"
      >
        <ImageStyleOption
          name={ImageStyleType.STANDARD}
          title="Standard"
          description="The downloadable image from the Reddit avatar builder."
        />
        <ImageStyleOption
          name={ImageStyleType.NFT_CARD}
          title="NFT Card"
          description="Avatar with its NFT background &amp; name."
          disabled={nftOptionsDisabled}
          disabledReason={nftOptionsDisabledReason}
        />
        <ImageStyleOption
          name={ImageStyleType.NO_BG}
          title="No Background"
          description="Just the Avatar."
        />
        <ImageStyleOption
          name={ImageStyleType.HEADSHOT_CIRCLE}
          title="UI Headshot"
          description="The upper half in a circle."
        />
        <ImageStyleOption
          name={ImageStyleType.HEADSHOT_HEX}
          title="Comment Headshot"
          description="The upper half in a hexagon."
        />

        {/* TODO: decide what we're doing with exposing avatar data... */}
        {/* {<AvatarData />} */}
      </div>
      <div class="pl-4 pr-4 pt-2 pb-2 text-xs text-center prose dark:prose-invert prose-sm">
        <p>
          Support this project by tipping{" "}
          <a
            href="https://www.reddit.com/user/h4l"
            target="_blank"
            rel="noreferrer"
          >
            /u/h4l
          </a>{" "}
          moons on Reddit, or via{" "}
          <a
            class="rounded dark:text-slate-50  bg-slate-200 dark:bg-slate-600 font-mono my-2 p-1 leading-6"
            target="_blank"
            rel="noreferrer"
            href={`https://blockscan.com/address/${HEADGEAR_ADDRESS}`}
          >
            {HEADGEAR_ADDRESS.substring(0, 20)}…
          </a>
        </p>
      </div>
      <BottomButtons />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AvatarData(): JSX.Element {
  return (
    <div>
      <h3 class="mt-6 mb-2 text-l font-semibold">Avatar Data</h3>
      <p>
        This data records the accessories and colors you chose when customizing
        your Avatar. Currently it can't (directly) be used for anything, but may
        be interesting to some people.
      </p>
      <div class="flex rounded-md shadow-sm mt-4 mb-4" role="group">
        <button
          type="button"
          disabled
          class={`
        ml-auto rounded-r-none py-2 px-4 text-sm font-medium
        ${BUTTON_STYLES}
      `}
        >
          Copy as JSON
        </button>
        <button
          type="button"
          class={`
        mr-auto rounded-l-none py-2 px-4 text-sm font-medium
        ${BUTTON_STYLES}
      `}
        >
          Copy <span class="font-mono">data:</span> URI
        </button>
      </div>
    </div>
  );
}

export function BottomButtons() {
  const controlsState = useContext(ControlsContext);

  const toggleImageOptionsUI = () => {
    if (controlsState.value === undefined) return;
    controlsState.value = {
      ...controlsState.value,
      imageOptionsUIOpen: !controlsState.value.imageOptionsUIOpen,
    };
  };
  return (
    <div class="flex">
      <DownloadSVGButton />
      <button
        aria-label="Settings"
        onClick={toggleImageOptionsUI}
        class={`flex-shrink
      ${
        controlsState.value?.imageOptionsUIOpen
          ? "bg-orange-600 relative z-10"
          : "bg-indigo-600"
      }
      hover:ring active:ring hover:ring-inset active:ring-inset hover:bg-gradient-radial hover:from-indigo-500 hover:to-indigo-600
      hover:text-white hover:ring-indigo-500 active:ring-indigo-400
      flex text-lg font-medium
      text-slate-50 p-3
    `}
      >
        <IconCog6 class="w-7 h-7 inline m-1" />
      </button>
    </div>
  );
}

const IMAGE_STYLE_NAMES: Map<ImageStyleType, string> = new Map([
  [ImageStyleType.STANDARD, "Standard"],
  [ImageStyleType.NFT_CARD, "NFT Card"],
  [ImageStyleType.NO_BG, "No Background"],
  [ImageStyleType.HEADSHOT_CIRCLE, "UI Headshot"],
  [ImageStyleType.HEADSHOT_HEX, "Comment Headshot"],
]);

export function DownloadSVGButton(): JSX.Element {
  const controlsState = useContext(ControlsContext).value;
  const avatarSvgState = useContext(AvatarSvgContext).value;

  const downloadUri = useMemo(() => {
    if (typeof avatarSvgState !== "string") return "#";
    const b64Svg = btoa(avatarSvgState);
    return `data:image/svg+xml;base64,${b64Svg}`;
  }, [avatarSvgState]);

  let filename: string | undefined;
  if (controlsState) {
    const imgStyleName = IMAGE_STYLE_NAMES.get(controlsState?.imageStyle);
    assert(imgStyleName);
    filename = `Reddit Avatar ${imgStyleName}.svg`;
  }
  const disabled = typeof avatarSvgState !== "string" || filename === undefined;

  return (
    <a
      role="button"
      aria-disabled={disabled || undefined}
      class={`\
      flex-grow
      border-r border-r-indigo-900
    ${
      disabled
        ? "cursor-not-allowed"
        : "hover:ring active:ring hover:ring-inset active:ring-inset hover:bg-gradient-radial hover:from-indigo-500 hover:to-indigo-600"
    }
    bg-indigo-600 hover:text-white hover:ring-indigo-500 active:ring-indigo-400
    flex text-lg font-medium
    text-slate-50 p-3
    `}
      onClick={disabled ? () => false : undefined}
      href={downloadUri}
      download={disabled ? undefined : filename}
    >
      <span
        class={`\
      ${disabled ? "" : "hover:scale-105"}
      m-auto hover:motion-reduce:scale-100  transition-transform ease-in
      `}
      >
        {iconArrowDown}{" "}
        <span
          class="text-inherit m-1 drop-shadow-lg shadow-slate-900"
          style="text-shadow: 0px 0px 3px rgb(0 0 0 / 0.3)"
        >
          Download SVG Image
        </span>
      </span>
    </a>
  );
}

export function ClosePopupButton() {
  return (
    <button
      class="absolute right-0 top-0 m-1 p-2 cursor-pointer text-gray-700 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
      title="Close"
      onClick={() => {
        window.close();
      }}
    >
      {iconCross}
    </button>
  );
}

type UninitialisedValue = {
  hasChanged: false;
  isInitial: false;
  current: undefined;
  previous: undefined;
};
type InitialisedValue<T> = {
  hasChanged: false;
  isInitial: true;
  current: T;
  previous: undefined;
};
type ChangedValue<T> = {
  hasChanged: true;
  isInitial: false;
  current: T;
  previous: T;
};
type ValueHistory<T> =
  | UninitialisedValue
  | InitialisedValue<T>
  | ChangedValue<T>;
function useValueHistory<T>(
  initial?: T
): [ValueHistory<T>, (value: T) => void] {
  return useReducer(
    (state: ValueHistory<T>, value: T): ValueHistory<T> => {
      // 3 possible states, uninitialised -> initialised -> changed
      // uninitialised:
      if (!state.hasChanged && !state.isInitial) {
        assert(state.previous === undefined);
        return value === undefined
          ? state
          : {
              current: value,
              previous: undefined,
              isInitial: true,
              hasChanged: false,
            };
      }
      // initialised
      else if (!state.hasChanged && state.isInitial) {
        return value === state.current
          ? state
          : {
              current: value,
              previous: state.current,
              isInitial: false,
              hasChanged: true,
            };
      }
      // changed
      return value === state.current
        ? state
        : {
            current: value,
            previous: state.current,
            isInitial: false,
            hasChanged: true,
          };
    },
    initial === undefined
      ? {
          current: undefined,
          previous: undefined,
          isInitial: false,
          hasChanged: false,
        }
      : {
          current: initial,
          previous: undefined,
          isInitial: true,
          hasChanged: false,
        }
  );
}

export function ImageOptions(): JSX.Element {
  const controlsState = useContext(ControlsContext);
  const fadingOut = useSignal(false);

  const [uiOpenValue, dispatch] = useValueHistory<boolean | undefined>(
    controlsState.value?.imageOptionsUIOpen
  );
  useEffect(() => {
    dispatch(controlsState.value?.imageOptionsUIOpen);
  }, [dispatch, controlsState.value?.imageOptionsUIOpen]);
  useEffect(() => {
    if (controlsState.value?.imageOptionsUIOpen) {
      fadingOut.value = true;
    }
  }, [fadingOut, controlsState.value?.imageOptionsUIOpen]);

  const hideImageOptions = () => {
    if (controlsState.value === undefined) return;
    controlsState.value = {
      ...controlsState.value,
      imageOptionsUIOpen: false,
    };
  };

  return (
    <Fragment>
      <div
        data-testid="modal-bg"
        onClick={hideImageOptions}
        onTransitionEnd={() => {
          fadingOut.value = false;
        }}
        class={`
        ${
          controlsState.value?.imageOptionsUIOpen
            ? "opacity-100"
            : fadingOut.value
            ? "opacity-0"
            : "hidden opacity-0"
        }
        transition-opacity
        absolute left-0 right-0 top-0 bottom-0 bg-gray-900 bg-opacity-50 dark:bg-opacity-80
        `}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Image Output Options"
        aria-hidden={!uiOpenValue.current}
        open={uiOpenValue.current}
        class={`absolute ${
          uiOpenValue.current
            ? "right-4"
            : fadingOut.value
            ? "-right-80"
            : "-right-80 invisible"
        }
        ${
          uiOpenValue.isInitial && uiOpenValue.current
            ? "transition-none"
            : "transition-[right]"
        }
        rounded-md
        bottom-20 w-80 px-4 _py-0
        flex flex-col
        bg-neutral-100 text-gray-900 dark:bg-gray-800 dark:text-slate-50`}
      >
        <button
          class="absolute right-0 top-0 m-1 p-2 cursor-pointer text-gray-700 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
          title="Close"
          onClick={() => {
            if (!controlsState.value) return;
            controlsState.value = {
              ...controlsState.value,
              imageOptionsUIOpen: false,
            };
          }}
        >
          {iconCross}
        </button>
        <h2 class="text-lg font-medium mx-2 mt-4">Download/copy images as:</h2>
        <div class="flex my-2">
          <div class="flex items-center h-5">
            <input
              id="output-image-format-svg"
              aria-describedby="output-image-format-svg-desc"
              type="radio"
              name="output-image-format"
              value="svg"
              checked={
                controlsState.value?.outputImageFormat === OutputImageFormat.SVG
              }
              onClick={() => {
                if (!controlsState.value) return;
                controlsState.value = {
                  ...controlsState.value,
                  outputImageFormat: OutputImageFormat.SVG,
                };
              }}
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div class="ml-2 text-sm">
            <label
              for="output-image-format-svg"
              class="font-medium text-gray-900 dark:text-gray-300"
            >
              Vector Images
            </label>
            <p
              id="output-image-format-svg-desc"
              class="text-xs font-normal text-gray-500 dark:text-gray-300"
            >
              Download and copy Avatars as vector images (SVG). These have the
              highest level of detail, but most websites and image editing tools
              can't open them.
            </p>
          </div>
        </div>

        <div class="flex my-2">
          <div class="flex items-center h-5">
            <input
              id="output-image-format-png"
              aria-describedby="output-image-format-png-desc"
              type="radio"
              name="output-image-format"
              value="png"
              checked={
                controlsState.value?.outputImageFormat === OutputImageFormat.PNG
              }
              onClick={() => {
                if (!controlsState.value) return;
                controlsState.value = {
                  ...controlsState.value,
                  outputImageFormat: OutputImageFormat.PNG,
                };
              }}
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div class="ml-2 text-sm">
            <label
              for="output-image-format-png"
              class="font-medium text-gray-900 dark:text-gray-300"
            >
              Normal Images
            </label>
            <p
              id="output-image-format-png-desc"
              class="text-xs font-normal text-gray-500 dark:text-gray-300"
            >
              Download and copy Avatars as fixed-size regular images (PNG). This
              is the best option for most people.
            </p>
            <div class="ml-4">
              <OutputImageScaleOptions />
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}

export function OutputImageScaleOptions(): JSX.Element {
  return (
    <Fragment>
      <OutputImageScaleRadio
        value={RasterImageSize.SMALL}
        label="Small"
        scale={1}
      />
      <OutputImageScaleRadio
        value={RasterImageSize.MEDIUM}
        label="Medium"
        scale={2}
      />
      <OutputImageScaleRadio
        value={RasterImageSize.LARGE}
        label="Large"
        scale={3}
      />
      <OutputImageScaleRadio
        value={RasterImageSize.XLARGE}
        label="X-Large"
        scale={4}
      />
      <OutputImageExactRadio
        value={RasterImageSize.EXACT_WIDTH}
        label="Exact width"
      />
      <OutputImageExactRadio
        value={RasterImageSize.EXACT_HEIGHT}
        label="Exact height"
      />
    </Fragment>
  );
}

export function OutputImageScaleRadio(props: {
  value:
    | RasterImageSize.SMALL
    | RasterImageSize.MEDIUM
    | RasterImageSize.LARGE
    | RasterImageSize.XLARGE;
  label: string;
  scale: number;
}): JSX.Element {
  const controlsState = useContext(ControlsContext);
  const [w, h] = [380 * props.scale, 600 * props.scale];
  return (
    <div class="flex my-1">
      <div class="flex items-center h-5">
        <input
          id={`output-image-scale-${props.value}`}
          aria-describedby={`output-image-scale-${props.value}-desc`}
          type="radio"
          name="output-image-scale"
          value={props.value}
          checked={controlsState.value?.rasterImageSize === props.value}
          onClick={() => {
            if (!controlsState.value) return;
            controlsState.value = {
              ...controlsState.value,
              rasterImageSize: props.value,
            };
          }}
          class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div class="ml-2 text-sm">
        <label
          for={`output-image-scale-${props.value}`}
          class="font-medium text-gray-900 dark:text-gray-300"
        >
          {props.label}{" "}
          <span class="font-normal text-xs">
            ≈ {w} {"\u00d7"} {h} pixels
          </span>
        </label>
      </div>
    </div>
  );
}

export function OutputImageExactRadio(props: {
  value: RasterImageSize.EXACT_HEIGHT | RasterImageSize.EXACT_WIDTH;
  label: string;
}): JSX.Element {
  const controlsState = useContext(ControlsContext);
  const input = useRef<HTMLInputElement>(null);
  const checked = controlsState.value?.rasterImageSize === props.value;
  const disabled = controlsState.value === undefined;
  const setImageSize = () => {
    if (!controlsState.value) return;
    controlsState.value = {
      ...controlsState.value,
      rasterImageSize: props.value,
    };
  };
  const focusInput = () => {
    input.current && input.current.focus();
  };

  return (
    <div class="flex my-1">
      <div class="flex items-center h-5">
        <input
          id={`output-image-scale-exact-${props.value}`}
          aria-describedby={`output-image-scale-exact-${props.value}-desc`}
          type="radio"
          name="output-image-scale"
          value={props.value}
          checked={checked}
          disabled={disabled}
          onClick={setImageSize}
          onMouseUp={focusInput}
          class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      <div class="ml-2 text-sm">
        <label
          for={`output-image-scale-exact-${props.value}-value`}
          class="font-medium text-gray-900 dark:text-gray-300"
        >
          {props.label}
        </label>
        <input
          ref={input}
          id={`output-image-scale-exact-${props.value}-value`}
          name={`output-image-scale-exact-${props.value}-value`}
          type="number"
          step="50"
          min="50"
          max="10000"
          value={
            (props.value === RasterImageSize.EXACT_WIDTH
              ? controlsState.value?.rasterImageExactWidth
              : controlsState.value?.rasterImageExactHeight) || 1000
          }
          onClick={setImageSize}
          onKeyUp={({ key }) => {
            if (key === "Enter") setImageSize();
          }}
          onBlur={(e) => {
            if (!controlsState.value) return;
            assert(e.target instanceof HTMLInputElement);
            let value: number | undefined;
            if (e.target?.value === "") {
              value = undefined;
            } else {
              value = Math.max(50, Math.min(10000, e.target?.valueAsNumber));
              if (Number.isNaN(value)) value = 50;
              controlsState.value = {
                ...controlsState.value,
                ...(props.value === RasterImageSize.EXACT_WIDTH
                  ? { rasterImageExactWidth: value }
                  : { rasterImageExactHeight: value }),
              };
            }
          }}
          placeholder="1234"
          class="
          bg-gray-50 rounded-lg border border-gray-300 text-gray-900
          block w-full px-1.5 py-1 my-1 text-sm
          focus:ring-blue-500 focus:border-blue-500
          dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        />
      </div>
    </div>
  );
}

export function Headgear() {
  return (
    // 800x600 is the current largest size a popup can be.
    <div class="w-[800px] h-[600px] flex flex-row relative text-base">
      <ClosePopupButton />
      <DisplayArea />
      <Controls />
      <ImageOptions />
    </div>
  );
}

export function ErrorBoundary(props: {
  errorState: Signal<Error | undefined>;
  children: ComponentChildren;
}) {
  const { children, errorState } = props;
  const [error, resetError] = useErrorBoundary();

  if (error && errorState.value) {
    throw new Error(
      `An error occurred while handling a previous error. Initial error: ${errorState.value}, New error: ${error}`
    );
  }
  if (error) {
    errorState.value = error instanceof Error ? error : new Error(`${error}`);
    resetError();
  }

  return <Fragment>{children}</Fragment>;
}

export function HeadgearIsVeryBrokenMessage() {
  return (
    <main class="prose m-12">
      <h1>Headgear is broken</h1>
      <p>
        An unrecoverable error occurred. If you could let{" "}
        <a
          href="https://www.reddit.com/user/h4l"
          target="_blank"
          rel="noreferrer"
        >
          /u/h4l
        </a>{" "}
        know about this, they should be able to fix it. Sorry!
      </p>
    </main>
  );
}

export function App() {
  // Our error handling strategy has two parts — things that are expected to
  // fail, and unexpected errors. The ErrorBoundary here is only to handle
  // unexpected errors thrown from the app. It shouldn't get triggered unless
  // the code has a bug, so it doesn't attempt to retain any app functionality
  // after failure. Things that are expected to fail have errors represented
  // in their state types, and error messages are shown in the regular UI as
  // part of the normal logic.
  const [error] = useState<Signal<Error | undefined>>(() => signal(undefined));
  useEffect(() => {
    if (error.value) {
      console.error(
        "Headgear failed with an unhandled error: ",
        error.value,
        error.value.stack
      );
    }
  }, [error.value]);

  const [rootState] = useState<RootState>(() => createRootState());
  useEffect(() => {
    if (rootState.avatarDataState.value.type === DataStateType.BEFORE_LOAD) {
      rootState.avatarDataState.value = { type: DataStateType.LOADING };
      _initialiseRootState(rootState);
    }
  }, [rootState]);

  if (error.value) {
    return <HeadgearIsVeryBrokenMessage />;
  }

  return (
    <AvatarDataContext.Provider value={rootState.avatarDataState}>
      <ControlsContext.Provider value={rootState.controlsState}>
        <AvatarSvgContext.Provider value={rootState.avatarSvgState}>
          <ErrorBoundary errorState={error}>
            <Headgear />
          </ErrorBoundary>
        </AvatarSvgContext.Provider>
      </ControlsContext.Provider>
    </AvatarDataContext.Provider>
  );
}

export async function _getUserCurrentAvatar(
  tab: chrome.tabs.Tab
): Promise<ResolvedAvatar | null> {
  const tabId = tab.id;
  assert(typeof tabId === "number");
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["reddit.js"],
  });
  const [err, avatar] = (await chrome.tabs.sendMessage(
    tabId,
    MSG_GET_AVATAR
  )) as GetAvatarMessageResponse;
  if (err) throw new GetAvatarError(err.message);
  return avatar;
}

export function createRootState(): RootState {
  const avatarDataState: Signal<AvatarDataState> = signal({
    type: DataStateType.BEFORE_LOAD,
  });
  const controlsState: Signal<ControlsState> = signal(undefined);
  const avatarSvgState = _createAvatarSvgState({
    avatarDataState,
    controlsState,
  });
  return {
    avatarDataState,
    controlsState,
    avatarSvgState,
  };
}

export function _initialiseRootState({
  avatarDataState,
  controlsState,
}: Pick<RootState, "avatarDataState" | "controlsState">) {
  _loadAvatarDataState(avatarDataState);
  _loadControlsState(controlsState);
  const port = chrome.runtime.connect({ name: PORT_IMAGE_CONTROLS_CHANGED });
  _persistControlsState({ state: controlsState, port });
}

export function _loadAvatarDataState(state: Signal<AvatarDataState>) {
  _loadAvatarDataStateAsync()
    .then((newState) => {
      state.value = newState;
    })
    .catch((err) => {
      const exception = err instanceof Error ? err : new Error(err);
      let error: AvatarDataError;
      if (exception instanceof GetAvatarError) {
        error = {
          type: AvatarDataErrorType.GET_AVATAR_FAILED,
          message: exception.message,
        };
      } else {
        error = { type: AvatarDataErrorType.UNKNOWN, exception };
      }
      state.value = { type: DataStateType.ERROR, error };
    });
}

async function _loadAvatarDataStateAsync(): Promise<AvatarDataState> {
  const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
  const [tab] = tabs;
  if (!tab.url?.startsWith("https://www.reddit.com/")) {
    return {
      type: DataStateType.ERROR,
      error: { type: AvatarDataErrorType.NOT_REDDIT_TAB, tab },
    };
  }
  const avatar = await _getUserCurrentAvatar(tab);
  if (avatar === null) {
    return {
      type: DataStateType.ERROR,
      error: { type: AvatarDataErrorType.USER_HAS_NO_AVATAR },
    };
  }
  return { type: DataStateType.LOADED, tab, avatar };
}

export function _loadControlsState(state: Signal<ControlsState>): void {
  _loadControlsStateFromStorage()
    .then((controlsState) => {
      state.value = controlsState;
    })
    // Just use defaults if we can't get a previous state from storage.
    .catch(() => {
      state.value = DEFAULT_CONTROLS_STATE;
    });
}

export async function _loadControlsStateFromStorage(): Promise<ControlsStateObject> {
  const controls = (await chrome.storage.sync.get(STORAGE_KEY_IMAGE_CONTROLS))[
    STORAGE_KEY_IMAGE_CONTROLS
  ];
  if (typeof controls === "object" && controls !== null) {
    const defaultedControls = Object.fromEntries(
      Object.entries(DEFAULT_CONTROLS_STATE).map(([k, v]) => [
        k,
        controls[k] !== undefined ? controls[k] : v,
      ])
    );
    if (isControlsStateObject(defaultedControls)) {
      return defaultedControls;
    }
  }
  throw new Error("storage does not contain a valid ControlsStateObject");
}

/**
 * Handle persisting the state of the UI.
 *
 * The actual persistence is done by our background service worker, because we
 * need to debounce the saving, and it won't get saved if the popup is closed
 * while we're waiting for a debounce to time out.
 */
export function _persistControlsState({
  state,
  port,
}: {
  state: Signal<ControlsState>;
  port: chrome.runtime.Port;
}): void {
  effect(() => {
    const controlsState = state.value;
    if (controlsState === undefined) return;
    port.postMessage(controlsState);
  });
}

export function _getPermittedImageStyle({
  requestedImageStyle,
  avatarData,
}: {
  requestedImageStyle: ImageStyleType;
  avatarData: AvatarDataState;
}): ImageStyleType {
  if (
    requestedImageStyle === ImageStyleType.NFT_CARD &&
    avatarData.type === DataStateType.LOADED &&
    !avatarData.avatar.nftInfo
  ) {
    // When restoring the UI state from storage, the Avatar may no longer be an
    // NFT avatar, so we can't rely on UI validation to prevent the requested
    // image style being for an NFT card for a non-NFT avatar.
    return ImageStyleType.STANDARD;
  }
  return requestedImageStyle;
}

export function _createAvatarSvgState({
  avatarDataState,
  controlsState,
}: {
  avatarDataState: Signal<AvatarDataState>;
  controlsState: Signal<ControlsState>;
}): Signal<AvatarSVGState> {
  const _composeAvatarSVGMemo = memoizeOne(
    (avatar: ResolvedAvatar): SVGElement => composeAvatarSVG({ avatar })
  );
  const _createAvatarSVGMemo = memoizeOne(
    (
      imageStyle: ImageStyleType,
      avatar: ResolvedAvatar,
      composedAvatar: SVGElement
    ): string => {
      let svg: SVGElement;
      if (imageStyle === ImageStyleType.NFT_CARD) {
        if (!avatar.nftInfo)
          throw new TypeError(
            "Cannot create ImageStyleType.NFT_CARD image: avatar has no nftInfo"
          );
        svg = createNFTCardAvatarSVG({
          composedAvatar,
          nftInfo: avatar.nftInfo,
          variant: NFTCardVariant.SHOP_INVENTORY,
        });
      } else if (imageStyle === ImageStyleType.NO_BG) {
        svg = composedAvatar;
      } else if (imageStyle === ImageStyleType.HEADSHOT_CIRCLE) {
        svg = createHeadshotCircleAvatarSVG({ composedAvatar });
      } else if (imageStyle === ImageStyleType.HEADSHOT_HEX) {
        svg = createHeadshotCommentsAvatarSVG({ composedAvatar });
      } else {
        svg = createStandardAvatarSVG({ composedAvatar });
      }

      return new XMLSerializer().serializeToString(svg);
    }
  );

  return computed(() => {
    const avatarData = avatarDataState.value;
    const controls = controlsState.value;
    if (avatarData.type !== DataStateType.LOADED || controls === undefined) {
      return undefined;
    }

    const avatar = avatarData.avatar;
    try {
      // useMemo() doesn't work outside a component context, and this can get
      // run asynchronously.
      const composedAvatar = _composeAvatarSVGMemo(avatar);
      const style = _getPermittedImageStyle({
        requestedImageStyle: controls.imageStyle,
        avatarData,
      });
      return _createAvatarSVGMemo(style, avatar, composedAvatar);
    } catch (e) {
      return e instanceof Error ? e : new Error(`${e}`);
    }
  });
}
