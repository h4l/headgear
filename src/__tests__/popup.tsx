import { Signal, effect, signal } from "@preact/signals";
import { fireEvent, render, screen, waitFor } from "@testing-library/preact";

import { mockChrome } from "./chrome.mock";

import { assert } from "../assert";
import {
  AvatarDataContext,
  AvatarDataErrorType,
  AvatarDataState,
  AvatarSVG,
  ClosePopupButton,
  ControlsContext,
  ControlsState,
  DataStateType,
  ImageStyleOption,
  _createAvatarSvgState,
  _loadAvatarDataState,
  createRootState,
} from "../popup";
import {
  ImageStyleType,
  PORT_IMAGE_CONTROLS_CHANGED,
  STORAGE_KEY_IMAGE_CONTROLS,
} from "../popup-state-persistence";
import { MSG_GET_AVATAR } from "../reddit-interaction";
import {
  SVGNS,
  composeAvatarSVG,
  createNFTCardAvatarSVG,
  createStandardAvatarSVG,
} from "../svg";

jest.mock("../svg.ts");

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
    const state1 = { imageStyle: ImageStyleType.NFT_CARD };
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

  test("controlsState loads saved state", async () => {
    await chrome.storage.sync.set({
      [STORAGE_KEY_IMAGE_CONTROLS]: { imageStyle: ImageStyleType.NFT_CARD },
    });

    const rootState = createRootState();

    await waitFor(() => {
      expect(rootState.controlsState.value).toEqual({
        imageStyle: ImageStyleType.NFT_CARD,
      });
    });
  });

  test.each`
    persistedValue
    ${undefined}
    ${{ imageStyle: "invalid value" }}
  `(
    "controlsState loads default value when stored value cannot be loaded",
    async ({ persistedValue }: { persistedValue: unknown }) => {
      await chrome.storage.sync.set({
        [STORAGE_KEY_IMAGE_CONTROLS]: persistedValue,
      });

      const rootState = createRootState();

      await waitFor(() => {
        expect(rootState.controlsState.value).toEqual({
          imageStyle: ImageStyleType.STANDARD,
        });
      });
    }
  );

  test("avatarDataState becomes NOT_REDDIT_TAB error state if tab is not reddit", (done) => {
    tab.url = "https://not-reddit.com/";
    const { avatarDataState } = createRootState();

    effect(() => {
      const state = avatarDataState.value;
      if (state.type === DataStateType.LOADING) return;
      else if (state.type === DataStateType.ERROR) {
        expect(chrome.tabs.query).toBeCalledWith({
          currentWindow: true,
          active: true,
        });
        expect(avatarDataState.value).toEqual({
          type: DataStateType.ERROR,
          error: { type: AvatarDataErrorType.NOT_REDDIT_TAB, tab },
        });
        done();
      } else {
        done(`unexpected state: ${state.type}`);
      }
    });
  });

  test("avatarDataState becomes AVATAR_LOADED if tab is reddit", (done) => {
    const mockAvatarData = { avatar: true };
    jest
      .mocked(chrome.tabs.sendMessage)
      .mockResolvedValue([undefined, mockAvatarData]);
    const { avatarDataState } = createRootState();

    effect(() => {
      const state = avatarDataState.value;
      if (state.type === DataStateType.LOADING) return;
      else if (state.type === DataStateType.LOADED) {
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

  test("avatarDataState becomes ERROR with type GET_AVATAR_FAILED if get-avatar message responds with an error", (done) => {
    jest
      .mocked(chrome.tabs.sendMessage)
      .mockResolvedValue([
        { message: "An expected error occurred" },
        undefined,
      ]);
    const { avatarDataState } = createRootState();

    effect(() => {
      const state = avatarDataState.value;
      if (state.type === DataStateType.LOADING) return;
      else if (state.type === DataStateType.ERROR) {
        expect(state.error).toEqual({
          type: AvatarDataErrorType.GET_AVATAR_FAILED,
          message: "An expected error occurred",
        });
        done();
      } else {
        done(`unexpected state: ${state.type}`);
      }
    });
  });

  test("avatarDataState becomes ERROR with type UNKNOWN if get-avatar handler throws", (done) => {
    jest
      .mocked(chrome.tabs.sendMessage)
      .mockRejectedValue(new Error("An unexpected error occurred"));
    const { avatarDataState } = createRootState();

    effect(() => {
      const state = avatarDataState.value;
      if (state.type === DataStateType.LOADING) return;
      else if (state.type === DataStateType.ERROR) {
        expect(state.error).toEqual({
          type: AvatarDataErrorType.UNKNOWN,
          exception: new Error("An unexpected error occurred"),
        });
        done();
      } else {
        done(`unexpected state: ${state.type}`);
      }
    });
  });
});

describe("_createAvatarSvgStateSignal()", () => {
  test.each`
    dataStateType            | imageStyleType
    ${DataStateType.LOADING} | ${ImageStyleType.STANDARD}
    ${DataStateType.ERROR}   | ${ImageStyleType.STANDARD}
    ${DataStateType.LOADING} | ${undefined}
    ${DataStateType.ERROR}   | ${undefined}
    ${DataStateType.LOADED}  | ${undefined}
  `(
    "returns undefined before Avatar data & image type is available",
    ({
      dataStateType,
      imageStyleType,
    }: {
      dataStateType: DataStateType;
      imageStyleType: ImageStyleType;
    }) => {
      const avatarDataState: Partial<AvatarDataState> = { type: dataStateType };
      const controlsState: ControlsState =
        imageStyleType === undefined
          ? undefined
          : { imageStyle: imageStyleType };
      const svgStateSignal = _createAvatarSvgState({
        avatarDataState: signal(avatarDataState as AvatarDataState),
        controlsState: signal(controlsState),
      });
      expect(svgStateSignal.value).toBe(undefined);
    }
  );

  test("handles failure to compose avatar accessories into single SVG", () => {
    const err = new Error("failed to generate SVG");
    jest.mocked(composeAvatarSVG).mockImplementation(() => {
      throw err;
    });

    const svgSignal = _createAvatarSvgState({
      avatarDataState: signal({
        type: DataStateType.LOADED,
        avatar: {},
      } as unknown as AvatarDataState),
      controlsState: signal({ imageStyle: ImageStyleType.NO_BG }),
    });

    expect(svgSignal.value).toEqual(err);
  });

  test.each`
    imageStyle                 | svgVariantFn
    ${ImageStyleType.STANDARD} | ${createStandardAvatarSVG}
    ${ImageStyleType.NFT_CARD} | ${createNFTCardAvatarSVG}
  `(
    "handles failure to generate styled SVG variant",
    ({
      imageStyle,
      svgVariantFn,
    }: {
      imageStyle: ImageStyleType;
      svgVariantFn: any;
    }) => {
      const mockSvg = document.createElementNS(SVGNS, "svg");
      jest.mocked(composeAvatarSVG).mockReturnValue(mockSvg);
      const err = new Error("failed to generate SVG");
      jest.mocked(svgVariantFn).mockImplementation(() => {
        throw err;
      });

      const svgSignal = _createAvatarSvgState({
        avatarDataState: signal({
          type: DataStateType.LOADED,
          avatar: { nftInfo: {} },
        } as unknown as AvatarDataState),
        controlsState: signal({ imageStyle }),
      });

      expect(svgSignal.value).toEqual(err);
    }
  );
  test.each`
    imageStyle                 | svgVariantFn
    ${ImageStyleType.STANDARD} | ${createStandardAvatarSVG}
    ${ImageStyleType.NO_BG}    | ${undefined}
    ${ImageStyleType.NFT_CARD} | ${createNFTCardAvatarSVG}
  `(
    "generates SVG",
    ({
      imageStyle,
      svgVariantFn,
    }: {
      imageStyle: ImageStyleType;
      svgVariantFn: any;
    }) => {
      const mockComposedSvg = document.createElementNS(SVGNS, "svg");
      const mockStyledSvg = document.createElementNS(SVGNS, "svg");
      mockStyledSvg.setAttribute("id", "styled");
      jest.mocked(composeAvatarSVG).mockReturnValue(mockComposedSvg);
      if (imageStyle !== ImageStyleType.NO_BG) {
        jest.mocked(svgVariantFn).mockReturnValue(mockStyledSvg);
      }

      const svgSignal = _createAvatarSvgState({
        avatarDataState: signal({
          type: DataStateType.LOADED,
          avatar: { nftInfo: {} },
        } as unknown as AvatarDataState),
        controlsState: signal({ imageStyle }),
      });

      if (imageStyle === ImageStyleType.NO_BG) {
        expect(svgSignal.value).toBe(
          `<svg xmlns=\"http://www.w3.org/2000/svg\"/>`
        );
      } else {
        expect(svgSignal.value).toBe(
          `<svg xmlns=\"http://www.w3.org/2000/svg\" id=\"styled\"/>`
        );
      }
    }
  );
});

describe("<ClosePopupButton>", () => {
  test("closes window on click", async () => {
    const close = jest.spyOn(window, "close").mockReturnValue();
    render(<ClosePopupButton />);
    fireEvent.click(await screen.findByRole("button"));
    await waitFor(() => {
      expect(close).toBeCalledTimes(1);
    });
  });
});

describe("<ImageStyleOption>", () => {
  test("sets imageStyle when clicked", async () => {
    const controlsState: Signal<ControlsState> = signal({
      imageStyle: ImageStyleType.NFT_CARD,
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

  test("renders disabledReason message", async () => {
    const controlsState: Signal<ControlsState> = signal(undefined);
    render(
      <ControlsContext.Provider value={controlsState}>
        <ImageStyleOption
          name={ImageStyleType.HEADSHOT_CIRCLE}
          title="The Title"
          description="A description."
          disabled={true}
          disabledReason={"The reason."}
        />
      </ControlsContext.Provider>
    );
    const radio = await screen.findByRole("tooltip");
    expect(radio).toHaveTextContent("The reason.");
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
    ${"loaded"}  | ${"not disabled"} | ${{ type: DataStateType.LOADED }}
    ${"loading"} | ${"disabled"}     | ${{ type: DataStateType.LOADING }}
    ${"error"}   | ${"disabled"}     | ${{ type: DataStateType.ERROR }}
  `(
    "is $disabled in $name state",
    async ({
      disabled,
      state,
    }: {
      disabled: "disabled" | "not disabled";
      state: AvatarDataState;
    }) => {
      const avatarDataState: Signal<AvatarDataState> = signal(state);
      const controlsState: Signal<ControlsState> = signal({
        imageStyle: ImageStyleType.HEADSHOT_CIRCLE,
      });
      render(
        <AvatarDataContext.Provider value={avatarDataState}>
          <ControlsContext.Provider value={controlsState}>
            <ImageStyleOption
              name={ImageStyleType.HEADSHOT_CIRCLE}
              title="The Title"
              description="A description."
            />
          </ControlsContext.Provider>
        </AvatarDataContext.Provider>
      );
      const radio = await screen.findByLabelText("The Title", { exact: false });
      if (disabled === "disabled") expect(radio).toBeDisabled();
      else expect(radio).not.toBeDisabled();
    }
  );
});

test("<AvatarSVG>", async () => {
  render(<AvatarSVG svg={`<svg xmlns="${SVGNS}" data-testid="foo"/>`} />);
  const insertedSvg = await screen.findByTestId("foo");
  expect(insertedSvg).toBeTruthy();
});
