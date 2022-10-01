import { Signal, signal } from "@preact/signals";
import { ComponentChildren, JSX, createContext, options } from "preact";
import { useContext } from "preact/hooks";

import { assert, assertNever } from "./assert";
import { ResolvedAvatar } from "./avatars";
import "./css.css";
import { GetAvatarMessageResponse, MSG_GET_AVATAR } from "./reddit-interaction";

enum HeadgearErrorType {
  UNKNOWN,
  NOT_REDDIT_TAB,
}
type HeadgearError =
  | { type: HeadgearErrorType.UNKNOWN; exception: Error }
  | {
      type: HeadgearErrorType.NOT_REDDIT_TAB;
      tab: chrome.tabs.Tab;
    };

enum HeadgearStateType {
  LOADING,
  ERROR,
  AVATAR_LOADED,
}
type HeadgearState =
  | { type: HeadgearStateType.LOADING }
  | { type: HeadgearStateType.ERROR; error: HeadgearError }
  | {
      type: HeadgearStateType.AVATAR_LOADED;
      tab: chrome.tabs.Tab;
      avatar: ResolvedAvatar;
    };

const HeadgearContext = createContext<Signal<HeadgearState>>(
  signal({ type: HeadgearStateType.LOADING })
);

const iconArrowDown = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="w-7 h-7 inline m-1 drop-shadow-lg"
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

function ImageStyleOption(props: {
  name: string;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <input
        type="radio"
        disabled={props.disabled}
        id={`image-style-${props.name}`}
        name="image-style"
        value={props.name}
        class="sr-only peer"
        required
      />
      {/* // inline-flex justify-between items-center p-5 w-full text-gray-500 //
      bg-white rounded-lg border border-gray-200 cursor-pointer //
      dark:hover:text-gray-300 dark:border-gray-700
      dark:peer-checked:text-blue-500 // peer-checked:border-blue-600
      peer-checked:text-blue-600 // hover:text-gray-600 hover:bg-gray-100
      dark:text-gray-400 dark:bg-gray-800 // dark:hover:bg-gray-700 */}
      <label
        // TODO: make consistent with buttons
        /*
        py-2 px-4 text-sm font-medium border
        bg-white text-gray-900  border-gray-200
        dark:bg-gray-700 dark:text-white dark:border-gray-600
        hover:bg-gray-100 hover:text-blue-700
        dark:hover:bg-gray-600 dark:hover:text-white
        active:z-10 active:ring-2 active:ring-blue-700 active:text-blue-700
        dark:active:ring-blue-500 dark:active:text-white
        */
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
    </div>
  );
}

function CouldNotLoadAvatarMessage(props: {
  title: string;
  children: ComponentChildren;
}): JSX.Element {
  return (
    <div class="h-full w-full p-20 bg-white text-gray-800">
      <svg class="w-1/4" viewBox="0 0 100 100">
        <use href="../img/avatar-loading-error.svg#root" />
      </svg>
      <h2 class="font-bold text-lg my-6">{props.title}</h2>
      <p>{props.children}</p>
    </div>
  );
}

export function DisplayArea() {
  const headgearState = useContext(HeadgearContext);

  let content: JSX.Element;
  if (headgearState.value.type === HeadgearStateType.ERROR) {
    const { type: errorType } = headgearState.value.error;
    if (errorType === HeadgearErrorType.NOT_REDDIT_TAB) {
      content = (
        <CouldNotLoadAvatarMessage title="Open a Reddit tab to see your avatar">
          <p class="my-2">
            Headgear needs a Reddit tab open to load your Avatar.
          </p>
        </CouldNotLoadAvatarMessage>
      );
    } else if (errorType === HeadgearErrorType.UNKNOWN) {
      content = (
        <CouldNotLoadAvatarMessage title="Something went wrong">
          <p class="my-2">
            Headgear could not load your Avatar because it was not able to get
            the data it needs from Reddit. This is probably a temporary problem.
          </p>
          <p class="my-2">
            If the Reddit is working and this keeps happening, there could be
            something wrong with Headgear.
          </p>
        </CouldNotLoadAvatarMessage>
      );
    } else {
      assertNever(errorType);
    }
  } else if (headgearState.value.type === HeadgearStateType.LOADING) {
    content = (
      <svg
        class="h-full w-full p-28 animate-pulse bg-white text-gray-200"
        viewBox="0 0 57.520256 100.00005"
      >
        <use href="../img/avatar-loading-skeleton_minimal.svg#skeleton" />
      </svg>
    );
  } else if (headgearState.value.type === HeadgearStateType.AVATAR_LOADED) {
    content = (
      <img
        class="object-contain w-full h-full drop-shadow-xl"
        src="../img/h4l_dl-repro.svg"
      />
    );
  } else {
    assertNever(headgearState.value);
  }

  return <div class="grow bg-slate-700 p-6">{content}</div>;
}

export function Controls() {
  return (
    <div class="w-96 h-[100%] flex flex-col bg-neutral-100 text-gray-900 dark:bg-gray-800 dark:text-slate-50">
      <div class="px-4 flex my-4">
        <img class="ml-auto w-14 mb-1 mr-3" src="../img/logo.svg"></img>
        <div class="mr-auto flex-shrink">
          <h1 class="text-3xl font-bold">Headgear</h1>
          <p class="text-xs">Unleash your Reddit Avatar.</p>
        </div>
      </div>

      <div class="border border-gray-300 dark:border-gray-600 border-l-0 border-r-0 flex-grow overflow-y-scroll pl-4 pr-4">
        <ImageStyleOption
          name="standard"
          title="Standard"
          description="The downloadable image from the Reddit avatar builder."
          disabled
        />
        <ImageStyleOption
          name="background"
          title="Profile page card"
          description="The version on your profile page."
        />
        <ImageStyleOption
          name="headshot-hex"
          title="Comment thread headshot"
          description="The upper half in a hexagon."
        />
        <ImageStyleOption
          name="headshot-circle"
          title="UI Headshot"
          description="The upper half in a circle."
        />

        <h3 class="mt-6 mb-2 text-l font-semibold">Avatar Data</h3>
        <p>
          This data records the accessories and colors you chose when
          customizing your Avatar. Currently it can't (directly) be used for
          anything, but may be interesting to some people.
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
      <div class="pl-4 pr-4 pt-2 pb-2 text-xs text-center">
        <p>Support this project if you found it useful.</p>
        <p>
          <a
            class="rounded dark:text-slate-50  bg-slate-200 dark:bg-slate-600 font-mono my-2 p-1 leading-6"
            target="_blank"
            href="https://polygonscan.com/address/0x0000000000000000000000000000000000000000"
          >
            0x0000000000000000000000000000000000000000
          </a>
        </p>
      </div>
      <a
        class={`\
    flex text-lg font-medium
    bg-indigo-600 hover:ring active:ring hover:ring-inset active:ring-inset hover:ring-indigo-500 active:ring-indigo-400
    text-slate-50 p-3
    `}
        href="data:text/plain;charset=utf-8,Hello%20World!%0A"
        download="hello.txt"
      >
        <span class="m-auto">
          {iconArrowDown}{" "}
          <span class="m-1 drop-shadow-lg shadow-white">
            Download SVG Image
          </span>
        </span>
      </a>
    </div>
  );
}

export function ClosePopupButton() {
  return (
    <button
      class="absolute right-0 top-0 m-1 p-2 cursor-pointer text-gray-700 hover:text-gray-600"
      title="Close"
      onClick={window.close.bind(window)}
    >
      {iconCross}
    </button>
  );
}
export function Headgear(props: { rootState: Signal<HeadgearState> }) {
  return (
    <HeadgearContext.Provider value={props.rootState}>
      {/* 800x600 is the current largest size a popup can be. */}
      <div class="w-[800px] h-[600px] flex flex-row relative text-base">
        <ClosePopupButton />
        <DisplayArea />
        <Controls />
      </div>
    </HeadgearContext.Provider>
  );
}

export async function getUserCurrentAvatar(
  tab: chrome.tabs.Tab
): Promise<ResolvedAvatar> {
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
  if (err) throw new Error(err.message);
  return avatar;
}

export function createRootState(): Signal<HeadgearState> {
  const rootState = signal<HeadgearState>({ type: HeadgearStateType.LOADING });
  _loadRootState(rootState);
  return rootState;
}

export function _loadRootState(state: Signal<HeadgearState>) {
  _loadRootStateAsync()
    .then((newState) => {
      state.value = newState;
    })
    .catch((err) => {
      console.error(err);
      const exception = err instanceof Error ? err : new Error(err);
      state.value = {
        type: HeadgearStateType.ERROR,
        error: { type: HeadgearErrorType.UNKNOWN, exception },
      };
    });
}

async function _loadRootStateAsync(): Promise<HeadgearState> {
  const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
  const [tab] = tabs;
  if (!tab.url?.startsWith("https://www.reddit.com/")) {
    console.log(`this is not a Reddit page`, tab.url);
    return {
      type: HeadgearStateType.ERROR,
      error: { type: HeadgearErrorType.NOT_REDDIT_TAB, tab },
    };
  }
  const avatar = await getUserCurrentAvatar(tab);
  console.log("avatar:", avatar);
  return { type: HeadgearStateType.AVATAR_LOADED, tab, avatar };
}
