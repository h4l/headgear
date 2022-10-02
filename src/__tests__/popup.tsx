import { Signal, effect, signal } from "@preact/signals";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";

import { mockChrome } from "./chrome.mock";

import { assert } from "../assert";
import {
  ClosePopupButton,
  ControlsContext,
  ControlsState,
  HeadgearContext,
  HeadgearErrorType,
  HeadgearState,
  HeadgearStateType,
  ImageStyleOption,
  _loadHeadgearState,
  createRootState,
} from "../popup";
import {
  ControlsStateObject,
  ImageStyleType,
  PORT_IMAGE_CONTROLS_CHANGED,
} from "../popup-state-persistence";
import { MSG_GET_AVATAR } from "../reddit-interaction";

beforeEach(() => {
  jest.resetAllMocks();
});

describe("createRootState()", () => {
  let tab: Partial<chrome.tabs.Tab> = {};
  beforeEach(() => {
    tab = {
      id: 123,
      url: "https://www.reddit.com/",
    };
    window.chrome = mockChrome();
    const console: Partial<Console> = {
      error: jest.fn(),
    };
    window.console = console as Console;

    jest
      .mocked(window.chrome.tabs.query)
      .mockResolvedValue([tab as chrome.tabs.Tab]);
  });

  test("controlsState changes trigger messages on image-controls-changed channel", () => {
    const state1 = { imageStyle: ImageStyleType.BACKGROUND };
    const state2 = { imageStyle: ImageStyleType.HEADSHOT_HEX };
    let port: chrome.runtime.Port | undefined = undefined;
    chrome.runtime.onConnect.addListener((_port) => {
      port = _port;
    });
    const connectInfo: chrome.runtime.ConnectInfo = {
      name: PORT_IMAGE_CONTROLS_CHANGED,
    };

    const rootState = createRootState();
    expect(chrome.runtime.connect).toHaveBeenCalledWith(connectInfo);
    assert(port !== undefined);
    port = port as chrome.runtime.Port;

    rootState.controlsState.value = state1;
    rootState.controlsState.value = state2;
    expect(jest.mocked(port.postMessage).mock.calls).toEqual([
      [state1],
      [state2],
    ]);
  });

  test("headgearState becomes NOT_REDDIT_TAB error state if tab is not reddit", (done) => {
    tab.url = "https://not-reddit.com/";
    const { headgearState } = createRootState();

    effect(() => {
      const state = headgearState.value;
      if (state.type === HeadgearStateType.LOADING) return;
      else if (state.type === HeadgearStateType.ERROR) {
        expect(chrome.tabs.query).toBeCalledWith({
          currentWindow: true,
          active: true,
        });
        expect(headgearState.value).toEqual({
          type: HeadgearStateType.ERROR,
          error: { type: HeadgearErrorType.NOT_REDDIT_TAB, tab },
        });
        done();
      } else {
        done(`unexpected state: ${state.type}`);
      }
    });
  });

  test("headgearState becomes AVATAR_LOADED if tab is reddit", (done) => {
    const mockAvatarData = { avatar: true };
    jest
      .mocked(chrome.tabs.sendMessage)
      .mockResolvedValue([undefined, mockAvatarData]);
    const { headgearState } = createRootState();

    effect(() => {
      const state = headgearState.value;
      if (state.type === HeadgearStateType.LOADING) return;
      else if (state.type === HeadgearStateType.AVATAR_LOADED) {
        expect(chrome.scripting.executeScript).toBeCalledWith({
          target: { tabId: 123 },
          files: ["reddit.js"],
        });
        expect(chrome.tabs.sendMessage).toBeCalledWith(123, MSG_GET_AVATAR);
        expect(state.tab).toBe(tab);
        expect(state.avatar).toBe(mockAvatarData);
        done();
      } else {
        done(`unexpected state: ${state.type}`);
      }
    });
  });

  test("headgearState becomes ERROR with type GET_AVATAR_FAILED if get-avatar message responds with an error", (done) => {
    jest
      .mocked(chrome.tabs.sendMessage)
      .mockResolvedValue([
        { message: "An expected error occurred" },
        undefined,
      ]);
    const { headgearState } = createRootState();

    effect(() => {
      const state = headgearState.value;
      if (state.type === HeadgearStateType.LOADING) return;
      else if (state.type === HeadgearStateType.ERROR) {
        expect(state.error).toEqual({
          type: HeadgearErrorType.GET_AVATAR_FAILED,
          message: "An expected error occurred",
        });
        done();
      } else {
        done(`unexpected state: ${state.type}`);
      }
    });
  });

  test("headgearState becomes ERROR with type UNKNOWN if get-avatar handler throws", (done) => {
    jest
      .mocked(chrome.tabs.sendMessage)
      .mockRejectedValue(new Error("An unexpected error occurred"));
    const { headgearState } = createRootState();

    effect(() => {
      const state = headgearState.value;
      if (state.type === HeadgearStateType.LOADING) return;
      else if (state.type === HeadgearStateType.ERROR) {
        expect(state.error).toEqual({
          type: HeadgearErrorType.UNKNOWN,
          exception: new Error("An unexpected error occurred"),
        });
        done();
      } else {
        done(`unexpected state: ${state.type}`);
      }
    });
  });
});

describe("ClosePopupButton", () => {
  test("closes window on click", async () => {
    const close = jest.spyOn(window, "close").mockReturnValue();
    render(<ClosePopupButton />);
    fireEvent.click(await screen.findByRole("button"));
    await waitFor(() => {
      expect(close).toBeCalledTimes(1);
    });
  });
});

describe("ImageStyleOption", () => {
  test("sets imageStyle when clicked", async () => {
    const controlsState: Signal<ControlsState> = signal({
      imageStyle: ImageStyleType.BACKGROUND,
    });
    render(
      <ControlsContext.Provider value={controlsState}>
        <ImageStyleOption
          name={ImageStyleType.HEADSHOT_CIRCLE}
          title="The Title"
          description="A description."
        />
      </ControlsContext.Provider>
    );
    fireEvent.click(await screen.getByLabelText("The Title", { exact: false }));
    await waitFor(() => {
      expect(controlsState.value?.imageStyle).toBe(
        ImageStyleType.HEADSHOT_CIRCLE
      );
    });
  });

  test("is disabled until state is present", async () => {
    const controlsState: Signal<ControlsState> = signal(undefined);
    render(
      <ControlsContext.Provider value={controlsState}>
        <ImageStyleOption
          name={ImageStyleType.HEADSHOT_CIRCLE}
          title="The Title"
          description="A description."
        />
      </ControlsContext.Provider>
    );
    const radio = await screen.findByLabelText("The Title", { exact: false });
    expect(radio).toBeDisabled();
  });

  test.each`
    name         | disabled          | state
    ${"loaded"}  | ${"not disabled"} | ${{ type: HeadgearStateType.AVATAR_LOADED }}
    ${"loading"} | ${"disabled"}     | ${{ type: HeadgearStateType.LOADING }}
    ${"error"}   | ${"disabled"}     | ${{ type: HeadgearStateType.ERROR }}
  `(
    "is $disabled in $name state",
    async ({
      disabled,
      state,
    }: {
      disabled: "disabled" | "not disabled";
      state: HeadgearState;
    }) => {
      const headgearState: Signal<HeadgearState> = signal(state);
      const controlsState: Signal<ControlsState> = signal({
        imageStyle: ImageStyleType.HEADSHOT_CIRCLE,
      });
      render(
        <HeadgearContext.Provider value={headgearState}>
          <ControlsContext.Provider value={controlsState}>
            <ImageStyleOption
              name={ImageStyleType.HEADSHOT_CIRCLE}
              title="The Title"
              description="A description."
            />
          </ControlsContext.Provider>
        </HeadgearContext.Provider>
      );
      const radio = await screen.findByLabelText("The Title", { exact: false });
      if (disabled === "disabled") expect(radio).toBeDisabled();
      else expect(radio).not.toBeDisabled();
    }
  );
});
