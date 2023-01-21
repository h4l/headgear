import { Signal, effect, signal, useSignal } from "@preact/signals";
import debounce from "lodash.debounce";
import memoizeOne from "memoize-one";
import { PostHog, posthog } from "posthog-js";
import { ComponentChildren, Fragment, JSX } from "preact";
import {
  useContext,
  useEffect,
  useErrorBoundary,
  useRef,
  useState,
} from "preact/hooks";

import { assert, assertNever } from "./assert";
import { ResolvedAvatar } from "./avatars";
import {
  throwIfExecuteScriptResultFailed,
  writeImageToClipboard,
} from "./compatibility";
import { computedAsync, serialiseExecutions } from "./computed-async";
import {
  AnalyticsPreference,
  ControlsStateObject,
  DEFAULT_CONTROLS_STATE,
  ImageStyleType,
  OutputImageFormat,
  PORT_IMAGE_CONTROLS_CHANGED,
  RasterImageSize,
  STORAGE_KEY_IMAGE_CONTROLS,
  isControlsStateObject,
} from "./popup-state-persistence";
import { AnalyticsConsent } from "./popup/analytics-consent";
import { getIsIncognitoSignal } from "./popup/incognito";
import {
  AnalyticsContext,
  AnalyticsState,
  AvatarDataContext,
  AvatarDataError,
  AvatarDataErrorType,
  AvatarDataState,
  AvatarSVGState,
  AvatarSvgContext,
  ControlsContext,
  ControlsState,
  DataStateType,
  OutputImage,
  OutputImageContext,
  OutputImageState,
  RootState,
} from "./popup/state";
import { BUTTON_STYLES } from "./popup/styles";
import { GetAvatarMessageResponse, MSG_GET_AVATAR } from "./reddit-interaction";
import {
  NFTCardVariant,
  composeAvatarSVG,
  createHeadshotCircleAvatarSVG,
  createHeadshotCommentsAvatarSVG,
  createNFTCardAvatarSVG,
  createStandardAvatarSVG,
} from "./svg";
import { rasteriseSVG } from "./svg-rasterisation";

const HEADGEAR_ADDRESS = "0xcF4CbFd13BCAc9E30d4fd666BD8d2a81536C01d5";

class GetAvatarError extends Error {}

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
 * cog-6-tooth Outline
 * https://heroicons.com/
 */
function IconCog6(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      class={props.class || "w-6 h-6"}
      style="filter: drop-shadow(0px 0px 3px rgb(0 0 0 / 0.5));"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

/**
 * document-duplicate Outline
 * https://heroicons.com/
 */
function IconCopy(props: { class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      class={props.class || "w-6 h-6"}
      style="filter: drop-shadow(0px 0px 3px rgb(0 0 0 / 0.5));"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
      />
    </svg>
  );
}

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

export function AvatarDataErrorMessage({
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

export function AvatarSVG({ svg }: { svg: SVGElement }) {
  return (
    <svg
      data-testid="avatar"
      class="object-contain w-full h-full drop-shadow-xl animate-fade-in"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg.outerHTML }}
    />
  );
}

export function DisplayArea() {
  const avatarDataState = useContext(AvatarDataContext);
  const controlsState = useContext(ControlsContext);
  const avatarSvgState = useContext(AvatarSvgContext);
  const outputImageState = useContext(OutputImageContext);

  let content: JSX.Element;
  if (avatarDataState.value.type === DataStateType.ERROR) {
    content = <AvatarDataErrorMessage error={avatarDataState.value.error} />;
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
  } else if (outputImageState.value instanceof Error) {
    content = (
      <CouldNotLoadAvatarMessage
        title="Something went wrong"
        logErrorContextMessage="Failed to generate output image: "
        logError={outputImageState.value}
      >
        <p>
          Headgear hit an error while generating the image to be
          downloaded/copied.
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
          name={ImageStyleType.HEADSHOT_HEX}
          title="Comment Headshot"
          description="The upper half in a hexagon."
        />
        <ImageStyleOption
          name={ImageStyleType.HEADSHOT_CIRCLE}
          title="UI Headshot"
          description="The upper half in a circle."
        />
        <ImageStyleOption
          name={ImageStyleType.NO_BG}
          title="No Background"
          description="Just the Avatar."
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
      <DownloadImageButton />
      {/* Chrome does not allow SVG (image/svg+xml) to be copied to the
          clipboard. We could copy it as text/plain, but that would be
          inconsistent with the expectation of copying an image, so I think it's
          best to just now allow copying SVG. */}
      {!(controlsState.value?.outputImageFormat === OutputImageFormat.SVG) && (
        <CopyImageButton />
      )}
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
        <IconCog6
          class={`
          hover:scale-105 transition-transform ease-out
          w-7 h-7 inline m-1`}
        />
      </button>
    </div>
  );
}

function bottomBarButtonStyle(disabled: boolean): string {
  return `\
  border-r border-r-indigo-900
  ${
    disabled
      ? "cursor-not-allowed"
      : "hover:ring active:ring hover:ring-inset active:ring-inset hover:bg-gradient-radial hover:from-indigo-500 hover:to-indigo-600"
  }
  bg-indigo-600 hover:text-white hover:ring-indigo-500 active:ring-indigo-400
  flex text-lg text-slate-50 p-3`;
}

const IMAGE_STYLE_NAMES: Map<ImageStyleType, string> = new Map([
  [ImageStyleType.STANDARD, "Standard"],
  [ImageStyleType.NFT_CARD, "NFT Card"],
  [ImageStyleType.NO_BG, "No Background"],
  [ImageStyleType.HEADSHOT_CIRCLE, "UI Headshot"],
  [ImageStyleType.HEADSHOT_HEX, "Comment Headshot"],
]);

export function DownloadImageButton(): JSX.Element {
  const controlsState = useContext(ControlsContext).value;
  const outputImageState = useContext(OutputImageContext).value;

  const isImageReady = !(
    outputImageState === undefined || outputImageState instanceof Error
  );
  const disabled = !isImageReady;
  const downloadUri = isImageReady ? outputImageState.url : "#";

  let filename: string | undefined;
  if (controlsState) {
    const imgStyleName = IMAGE_STYLE_NAMES.get(controlsState?.imageStyle);
    assert(imgStyleName);
    filename = `Reddit Avatar ${imgStyleName}.${controlsState.outputImageFormat}`;
  }

  return (
    <a
      role="button"
      aria-disabled={disabled || undefined}
      class={`flex-grow ${bottomBarButtonStyle(disabled)}`}
      onClick={disabled ? () => false : undefined}
      href={downloadUri}
      download={disabled ? undefined : filename}
    >
      <span
        class={`\
      ${disabled ? "" : "hover:scale-105"}
      m-auto hover:motion-reduce:scale-100  transition-transform ease-out
      `}
      >
        {iconArrowDown}{" "}
        <span
          class="text-inherit m-1 drop-shadow-lg shadow-slate-900"
          style="text-shadow: 0px 0px 3px rgb(0 0 0 / 0.3)"
        >
          {controlsState &&
          controlsState.outputImageFormat === OutputImageFormat.SVG
            ? "Download SVG Image"
            : "Download Image"}
        </span>
      </span>
    </a>
  );
}

enum CopyState {
  BEFORE_COPY,
  COPYING,
  COPIED,
  FAILED,
}

export function CopyImageButton(): JSX.Element {
  const outputImageState = useContext(OutputImageContext);
  const hovering = useSignal(false);
  const copyState = useSignal(CopyState.BEFORE_COPY);
  const hidden = useSignal(false);

  const isImageReady = !(
    outputImageState.value === undefined ||
    outputImageState.value instanceof Error
  );
  const disabled = !isImageReady;

  const copyImage = () => {
    if (
      outputImageState.value === undefined ||
      outputImageState.value instanceof Error
    ) {
      return;
    }
    copyState.value = CopyState.COPYING;
    const imageBlob = outputImageState.value.blob;
    writeImageToClipboard(imageBlob)
      .then(() => {
        copyState.value = CopyState.COPIED;
      })
      .catch((e) => {
        console.error(
          "Failed to copy image data to clipboard:",
          Object.getPrototypeOf(e),
          e.message
        );
        copyState.value = CopyState.FAILED;
      });
  };
  const labels = {
    [CopyState.BEFORE_COPY]: "Copy Image",
    [CopyState.COPYING]: "Copy Image",
    [CopyState.COPIED]: "Image Copied!",
    [CopyState.FAILED]: "Copy Failed",
  };

  return (
    <span class="relative flex-shrink">
      <div
        aria-role="tooltip"
        class={`-top-10 -left-[2.7rem] flex absolute w-36
        ${hovering.value ? "opacity-100" : "opacity-0"}
        ${hidden.value ? "hidden" : ""}
        transition-opacity duration-300`}
      >
        <div
          role="tooltip"
          class={`flex-shrink mx-auto
         z-10 py-2 px-3
        text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm
        dark:bg-gray-700`}
        >
          {labels[copyState.value]}
        </div>
      </div>

      <button
        aria-label="Copy Image"
        disabled={disabled || undefined}
        onClick={disabled ? () => false : copyImage}
        onTransitionEnd={() => {
          if (!hovering.value) hidden.value = true;
        }}
        onMouseEnter={() => {
          copyState.value = CopyState.BEFORE_COPY;
          hovering.value = true;
          hidden.value = false;
        }}
        onMouseLeave={() => {
          hovering.value = false;
        }}
        class={bottomBarButtonStyle(disabled)}
      >
        <span
          class={`
        ${disabled ? "" : "hover:scale-105"}
        m-auto hover:motion-reduce:scale-100  transition-transform ease-out`}
        >
          <IconCopy class="w-7 h-7 inline m-1" />
        </span>
      </button>
    </span>
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

export function ImageOptions(): JSX.Element {
  const controlsState = useContext(ControlsContext);
  const fadingOut = useSignal(false);

  // We disable transitions if the UI is starting with the dialog open.
  const [wasClosed, setWasClosed] = useState<boolean>(false);
  useEffect(() => {
    if (!wasClosed && controlsState.value?.imageOptionsUIOpen === false) {
      setWasClosed(true);
    }
  }, [wasClosed, controlsState.value?.imageOptionsUIOpen]);
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

  const openAnalyticsConsentUI = () => {
    if (controlsState.value === undefined) return;
    controlsState.value = {
      ...controlsState.value,
      analyticsConsentUIOpen: true,
    };
  };

  const uiOpen = !!controlsState.value?.imageOptionsUIOpen;

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
        aria-hidden={!uiOpen}
        open={uiOpen}
        class={`absolute z-10 shadow-xl ${
          uiOpen
            ? "right-4"
            : fadingOut.value
            ? "-right-80"
            : "-right-80 invisible"
        }
        ${!wasClosed && uiOpen ? "transition-none" : "transition-[right]"}
        rounded-md
        bottom-4 w-80 px-4 py-4
        flex flex-col
        bg-neutral-100 text-gray-900 dark:bg-gray-800 dark:text-slate-50
        dark:border dark:border-slate-700`}
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
        <h2 class="text-lg font-medium">Download/copy images as:</h2>
        <div class="flex my-2 ml-2">
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

        <div class="flex my-2 ml-2">
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

        <div>
          <button
            type="button"
            class={`rounded py-1 px-2 text-xs font-medium mt-4 ${BUTTON_STYLES}`}
            onClick={openAnalyticsConsentUI}
          >
            Usage Sharing Options
          </button>
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
  const avatarSvgState = useContext(AvatarSvgContext);

  let scaledSize: { width?: number; height?: number } = {};
  if (avatarSvgState.value && !(avatarSvgState.value instanceof Error)) {
    const { width, height } = _getBaseSize(avatarSvgState.value);
    scaledSize = { width: width * props.scale, height: height * props.scale };
  }
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
              outputImageFormat: OutputImageFormat.PNG,
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
          <span class="w-16 inline-block">{props.label} </span>
          <span class="font-normal text-xs">
            {scaledSize.width || "?"} {"\u00d7"} {scaledSize.height || "?"}{" "}
            pixels
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
      outputImageFormat: OutputImageFormat.PNG,
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
      <AnalyticsConsent />
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
  const [analyticsStateSignal] = useState<Signal<AnalyticsState>>(
    signal(undefined)
  );
  useEffect(() => {
    _initAnalyticsState({
      analyticsStateSignal,
      controlsStateSignal: rootState.controlsState,
    });
  }, [rootState, analyticsStateSignal]);

  if (error.value) {
    return <HeadgearIsVeryBrokenMessage />;
  }

  return (
    <AvatarDataContext.Provider value={rootState.avatarDataState}>
      <ControlsContext.Provider value={rootState.controlsState}>
        <AvatarSvgContext.Provider value={rootState.avatarSvgState}>
          <OutputImageContext.Provider value={rootState.outputImageState}>
            <AnalyticsContext.Provider value={analyticsStateSignal}>
              <ErrorBoundary errorState={error}>
                <Headgear />
              </ErrorBoundary>
            </AnalyticsContext.Provider>
          </OutputImageContext.Provider>
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
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["/reddit.js"],
  });
  throwIfExecuteScriptResultFailed(result);
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
  const outputImageState = _createOutputImageState({
    controlsState,
    avatarSvgState,
  });
  return {
    avatarDataState,
    controlsState,
    avatarSvgState,
    outputImageState,
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
    ): SVGElement | Promise<SVGElement> => {
      let svg: Promise<SVGElement> | SVGElement;
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

      return svg;
    }
  );

  return computedAsync({
    signals: { avatarDataState, controlsState },
    initial: undefined,
    async compute({
      signalValues: { avatarDataState: avatarData, controlsState: controls },
    }): Promise<AvatarSVGState> {
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
        return await _createAvatarSVGMemo(style, avatar, composedAvatar);
      } catch (e) {
        return e instanceof Error ? e : new Error(`${e}`);
      }
    },
  });
}

/**
 * Create a Signal to an OutputImageState that's Asynchronously updated to
 * contain an image of the current Avatar's SVG. The format and size of the
 * image varies with the ControlsState Signal's value.
 */
export function _createOutputImageState({
  avatarSvgState,
  controlsState,
}: Pick<
  RootState,
  "avatarSvgState" | "controlsState"
>): Signal<OutputImageState> {
  // Creating a PNG image is asynchronous. We can receive state updates while
  // an async OutputImage creation is ongoing, so we need to be able behave
  // sensibly when this happens:
  //  - don't allow multiple expensive image creation jobs to run in parallel
  //  - don't start a job if there's a newer one that's superseded it

  let previousValue: OutputImage | undefined;
  return computedAsync({
    signals: {
      avatarSvgState,
      controlsState,
    },
    initial: undefined,
    compute: serialiseExecutions(
      async ({
        signalValues: { avatarSvgState: svg, controlsState: controls },
        superseded,
      }): Promise<OutputImageState> => {
        if (svg instanceof Error) return svg;
        if (svg === undefined || controls === undefined) return;
        // bail out early if we've been superseded
        if ((await Promise.race([superseded, undefined])) !== undefined) return;

        let blob: Blob;
        try {
          if (controls.outputImageFormat === OutputImageFormat.SVG) {
            blob = new Blob([new XMLSerializer().serializeToString(svg)], {
              type: "image/svg+xml",
            });
          } else {
            assert(controls.outputImageFormat === OutputImageFormat.PNG);
            const size = _measureScaledSVG({ svg, controlsState: controls });
            blob = await rasteriseSVG({ svg, ...size });
          }
        } catch (e) {
          console.error("output image generation failed:", e);
          return e instanceof Error ? e : new Error(`${e}`);
        }

        const result: OutputImage = {
          format: controls.outputImageFormat,
          blob,
          mimeType: blob.type,
          url: URL.createObjectURL(blob),
        };

        // We are responsible for releasing blob URLs when they're no longer
        // in use.
        if (previousValue) URL.revokeObjectURL(previousValue.url);
        previousValue = result;

        return result;
      }
    ),
  });
}

const imageSizeScaleFactors: Record<
  Exclude<
    RasterImageSize,
    RasterImageSize.EXACT_HEIGHT | RasterImageSize.EXACT_WIDTH
  >,
  number
> = {
  [RasterImageSize.SMALL]: 1,
  [RasterImageSize.MEDIUM]: 2,
  [RasterImageSize.LARGE]: 3,
  [RasterImageSize.XLARGE]: 4,
};

export function _measureScaledSVG({
  svg,
  controlsState,
}: {
  svg: SVGElement;
  controlsState: Pick<
    ControlsStateObject,
    "rasterImageSize" | "rasterImageExactHeight" | "rasterImageExactWidth"
  >;
}): { width: number; height: number } {
  // our SVG never has exact sizes set on the root, but we do always have a
  // viewBox to allow proportional scaling.
  assert(!svg.hasAttribute("width"));
  assert(!svg.hasAttribute("height"));
  assert(svg.hasAttribute("viewBox"));

  const { width: baseWidth, height: baseHeight } = _getBaseSize(svg);

  if (controlsState.rasterImageSize === RasterImageSize.EXACT_WIDTH) {
    const width = controlsState.rasterImageExactWidth;
    const scale = width / baseWidth;
    return { width, height: baseHeight * scale };
  } else if (controlsState.rasterImageSize === RasterImageSize.EXACT_HEIGHT) {
    const height = controlsState.rasterImageExactHeight;
    const scale = height / baseHeight;
    return { width: baseWidth * scale, height };
  }
  const scale = imageSizeScaleFactors[controlsState.rasterImageSize];
  return { width: baseWidth * scale, height: baseHeight * scale };
}

export function _getBaseSize(avatarSVG: SVGElement): {
  width: number;
  height: number;
} {
  const viewBox = (avatarSVG.getAttribute("viewBox") || "")
    .split(" ")
    .map((n) => Number.parseInt(n, 10));
  if (!(viewBox.length === 4 && viewBox.every((n) => !Number.isNaN(n)))) {
    throw new Error(
      `svg viewBox attribute is invalid: ${avatarSVG.getAttribute("viewBox")}`
    );
  }
  return { width: viewBox[2], height: viewBox[3] };
}

/**
 * Subscribe to a ControlsState Signal, propagating changes to an AnalyticsState
 * Signal.
 *
 * The analytics PostHog instance is created, and opted in/out as the
 * ControlsState.analyticsPreference value changes.
 */
export function _initAnalyticsState({
  analyticsStateSignal,
  controlsStateSignal,
}: {
  analyticsStateSignal: Signal<AnalyticsState>;
  controlsStateSignal: Signal<ControlsState>;
}): Signal<AnalyticsState> {
  let postHog: PostHog | undefined = analyticsStateSignal.value;
  let lastPref: AnalyticsPreference | undefined;
  const isIncognito = getIsIncognitoSignal();
  effect(() => {
    // Only enable analytics in non-incognito windows.
    if (isIncognito.value !== false) return;

    const pref = controlsStateSignal.value?.analyticsPreference;
    if (lastPref === pref) return;
    lastPref = pref;
    if (pref === AnalyticsPreference.OPTED_IN) {
      // We only init() a PostHog instance at the point that a user opts in.
      // Another approach would be to init() it with opt out on by default, but
      // I prefer the harder approach of just not touching the analytics code if
      // it's not enabled. Also ensures the app works without some subtle
      // dependency on analytics features (like feature flags if we start using
      // them.)
      if (postHog === undefined) {
        postHog =
          posthog.init("phc_K9Dy2B8IvBa1kToYWXN6wuvdkmnBHWqkz6o2hmJZl1e", {
            api_host: "https://eu.posthog.com",
            persistence: "localStorage",
            debug: HeadgearGlobal.HEADGEAR_BUILD.mode === "development",
          }) ?? undefined;
        assert(postHog);
        posthog.register({
          ...(HeadgearGlobal.HEADGEAR_BUILD.mode === "development"
            ? { headgearDev: true }
            : {}),
          headgearVersion: HeadgearGlobal.HEADGEAR_BUILD.version,
          headgearBrowser: HeadgearGlobal.HEADGEAR_BUILD.browserTarget,
        });
      } else {
        postHog.opt_in_capturing();
      }
      analyticsStateSignal.value = postHog;
    } else if (pref === AnalyticsPreference.OPTED_OUT) {
      // When opting out, we keep the PostHog instance around (in case it gets
      // opted in again), but we remove it from the published state, so that
      // nothing in the app will report events to it. Even if we did report
      // events. they wouldn't do anything because of the opt out. Next time the
      // user opens the app we won't init a PostHog instance.
      if (postHog) {
        postHog.opt_out_capturing();
      }
      analyticsStateSignal.value = undefined;
    }
  });
  return analyticsStateSignal;
}
