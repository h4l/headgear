import { Signal, signal } from "@preact/signals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/preact";
import { posthog } from "posthog-js";
import { ComponentChildren } from "preact";
import { Fragment, JSX } from "preact/jsx-runtime";

import { mockChrome } from "./chrome.mock";
import { OptInOut, resetMockPostHog } from "./posthog-js.mock";

import { assert } from "../assert";
import { NFTInfo, ResolvedAvatar } from "../avatars";
import {
  AvatarSVG,
  ClosePopupButton,
  Controls,
  CopyImageButton,
  CouldNotLoadAvatarMessage,
  DisplayArea,
  DownloadImageButton,
  ErrorBoundary,
  ImageOptions,
  ImageStyleOption,
  OutputImageScaleRadio,
  _createAvatarSvgState,
  _createOutputImageState,
  _getBaseSize,
  _initAnalyticsState,
  _initialiseRootState,
  _internals,
  _measureScaledSVG,
  createRootState,
} from "../popup";
import {
  AnalyticsPreference,
  ControlsStateObject,
  DEFAULT_CONTROLS_STATE,
  ImageStyleType,
  OutputImageFormat,
  PORT_IMAGE_CONTROLS_CHANGED,
  RasterImageSize,
  STORAGE_KEY_IMAGE_CONTROLS,
} from "../popup-state-persistence";
import { getIsIncognitoSignal } from "../popup/incognito";
import {
  AnalyticsContext,
  AnalyticsState,
  AvatarDataContext,
  AvatarDataErrorType,
  AvatarDataState,
  AvatarSVGState,
  AvatarSvgContext,
  ControlsContext,
  ControlsState,
  DataStateType,
  OutputImageContext,
  OutputImageState,
  RootState,
} from "../popup/state";
import { GetAvatarMessage, MSG_GET_AVATAR } from "../reddit-interaction";
import {
  SVGNS,
  parseSVG as _parseSVG,
  composeAvatarSVG,
  createHeadshotCircleAvatarSVG,
  createHeadshotCommentsAvatarSVG,
  createNFTCardAvatarSVG,
  createStandardAvatarSVG,
} from "../svg";
import { rasteriseSVG } from "../svg-rasterisation";

jest.mock("../popup/incognito.ts");
jest.mock("../svg.ts");
jest.mock("../svg-rasterisation.ts");

function parseSVG(svg: string): SVGElement {
  const parse: typeof _parseSVG = jest.requireActual("../svg").parseSVG;
  return parse({ svgSource: svg });
}

function readBlobAsText(blob: Blob): Promise<string> {
  // jsdom doesn't implement Blob.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      assert(typeof reader.result === "string");
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  window.chrome = mockChrome();
  jest.spyOn(console, "error").mockImplementation((...args) => {
    throw new Error(`unexpected console.error() call: ${args}`);
  });
});
afterEach(() => {
  jest.mocked(console.error).mockRestore();
  jest.clearAllMocks();
});

describe("create & initialise RootState", () => {
  let tab: Partial<chrome.tabs.Tab> = {};
  beforeEach(() => {
    tab = {
      id: 123,
      url: "https://www.reddit.com/",
    };
    jest
      .mocked(window.chrome.tabs.query)
      .mockResolvedValue([tab as chrome.tabs.Tab]);
    jest.mocked(chrome.cookies.get).mockResolvedValue({
      name: "token_v2",
      value: "__token__",
    } as chrome.cookies.Cookie);
  });

  test("controlsState changes trigger messages on image-controls-changed channel", () => {
    const state1 = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.NFT_CARD,
    };
    const state2 = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.HEADSHOT_HEX,
    };
    let port: chrome.runtime.Port | undefined;
    chrome.runtime.onConnect.addListener((_port) => {
      port = _port;
    });
    const connectInfo: chrome.runtime.ConnectInfo = {
      name: PORT_IMAGE_CONTROLS_CHANGED,
    };

    const rootState = createRootState();
    _initialiseRootState(rootState);

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
    _initialiseRootState(rootState);

    await waitFor(() => {
      expect(rootState.controlsState.value).toEqual({
        ...DEFAULT_CONTROLS_STATE,
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
      _initialiseRootState(rootState);

      await waitFor(() => {
        expect(rootState.controlsState.value).toEqual({
          ...DEFAULT_CONTROLS_STATE,
          imageStyle: ImageStyleType.STANDARD,
        });
      });
    }
  );

  test("avatarDataState becomes NOT_REDDIT_TAB error state if tab is not reddit", async () => {
    tab.url = "https://not-reddit.com/";
    const rootState = createRootState();
    _initialiseRootState(rootState);
    const { avatarDataState } = rootState;

    await waitFor(() => {
      expect(avatarDataState.value.type).toBe(DataStateType.ERROR);
    });
    expect(chrome.tabs.query).toBeCalledWith({
      currentWindow: true,
      active: true,
    });
    expect(avatarDataState.value).toEqual({
      type: DataStateType.ERROR,
      error: { type: AvatarDataErrorType.NOT_REDDIT_TAB, tab },
    });
  });

  test.each([[null], [{ name: "token_v2", value: "" }]])(
    "avatarDataState becomes AUTH_TOKEN_NOT_AVAILABLE error state if an auth cookie is not available",
    async (getCookieResult: Partial<chrome.cookies.Cookie> | null) => {
      jest
        .mocked(chrome.cookies.get)
        .mockResolvedValue(getCookieResult as chrome.cookies.Cookie | null);
      jest
        .mocked(chrome.scripting.executeScript)
        .mockResolvedValue([{ frameId: 0, result: null }] as never);

      const rootState = createRootState();
      _initialiseRootState(rootState);
      const { avatarDataState } = rootState;

      await waitFor(() => {
        expect(avatarDataState.value.type).toBe(DataStateType.ERROR);
      });
      expect(chrome.tabs.query).toBeCalledWith({
        currentWindow: true,
        active: true,
      });
      expect(chrome.cookies.get).toBeCalledWith({
        url: "https://www.reddit.com/",
        name: "token_v2",
      });
      expect(avatarDataState.value).toEqual({
        type: DataStateType.ERROR,
        error: {
          type: AvatarDataErrorType.AUTH_TOKEN_NOT_AVAILABLE,
          message: "reddit.com token_v2 cookie not available",
        },
      });
    }
  );

  test("avatarDataState becomes AVATAR_LOADED if tab is reddit", async () => {
    const mockAvatarData = { avatar: true };
    jest
      .mocked(chrome.scripting.executeScript)
      .mockResolvedValue([{ frameId: 0, result: null }] as never);
    jest
      .mocked(chrome.tabs.sendMessage)
      .mockResolvedValue([undefined, mockAvatarData]);
    const rootState = createRootState();
    _initialiseRootState(rootState);
    const { avatarDataState } = rootState;

    await waitFor(() => {
      expect(avatarDataState.value.type).toBe(DataStateType.LOADED);
    });
    assert(avatarDataState.value.type === DataStateType.LOADED);
    expect(chrome.scripting.executeScript).toBeCalledWith({
      target: { tabId: 123 },
      files: ["/reddit.js"],
    });
    const getAvatarMessage: GetAvatarMessage = {
      type: MSG_GET_AVATAR,
      apiToken: "__token__",
    };
    expect(chrome.tabs.sendMessage).toBeCalledWith(123, getAvatarMessage);
    expect(avatarDataState.value.tab).toBe(tab);
    expect(avatarDataState.value.avatar).toBe(mockAvatarData);
  });

  test("avatarDataState becomes ERROR with type GET_AVATAR_FAILED if get-avatar message responds with an error", async () => {
    jest
      .mocked(chrome.scripting.executeScript)
      .mockResolvedValue([{ frameId: 0, result: null }] as never);
    jest
      .mocked(chrome.tabs.sendMessage)
      .mockResolvedValue([
        { message: "An expected error occurred" },
        undefined,
      ]);
    const rootState = createRootState();
    _initialiseRootState(rootState);
    const { avatarDataState } = rootState;

    await waitFor(() => {
      expect(avatarDataState.value.type).toBe(DataStateType.ERROR);
    });
    assert(avatarDataState.value.type === DataStateType.ERROR);
    expect(avatarDataState.value.error).toEqual({
      type: AvatarDataErrorType.GET_AVATAR_FAILED,
      message: "An expected error occurred",
    });
  });

  test("avatarDataState becomes ERROR with type UNKNOWN if get-avatar handler throws", async () => {
    jest
      .mocked(chrome.scripting.executeScript)
      .mockResolvedValue([{ frameId: 0, result: null }] as never);
    jest
      .mocked(chrome.tabs.sendMessage)
      .mockRejectedValue(new Error("An unexpected error occurred"));
    const rootState = createRootState();
    _initialiseRootState(rootState);
    const { avatarDataState } = rootState;

    await waitFor(() => {
      expect(avatarDataState.value.type).toBe(DataStateType.ERROR);
    });
    assert(avatarDataState.value.type === DataStateType.ERROR);
    expect(avatarDataState.value.error).toEqual({
      type: AvatarDataErrorType.UNKNOWN,
      exception: new Error("An unexpected error occurred"),
    });
  });
});

describe("_createAvatarSvgState()", () => {
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
          : { ...DEFAULT_CONTROLS_STATE, imageStyle: imageStyleType };
      const svgStateSignal = _createAvatarSvgState({
        avatarDataState: signal(avatarDataState as AvatarDataState),
        controlsState: signal(controlsState),
      });
      expect(svgStateSignal.value).toBe(undefined);
    }
  );

  test("defaults to available image style if NFT style is requested with non-NFT calendar", async () => {
    jest
      .mocked(createStandardAvatarSVG)
      .mockReturnValue(document.createElementNS(SVGNS, "svg"));
    const avatarDataState: Partial<AvatarDataState> = {
      type: DataStateType.LOADED,
      avatar: { nftInfo: undefined, accessories: [], styles: [] },
    };
    const controlsState = signal<ControlsState>(undefined);
    const svgStateSignal = _createAvatarSvgState({
      avatarDataState: signal(avatarDataState as AvatarDataState),
      controlsState,
    });
    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.NFT_CARD,
    };
    await waitFor(async () => {
      expect(svgStateSignal.value).not.toBeUndefined();
    });
    expect(svgStateSignal.value).toMatchInlineSnapshot(`<svg />`);
    expect(createStandardAvatarSVG).toHaveBeenCalledTimes(1);
  });

  test("handles failure to compose avatar accessories into single SVG", async () => {
    const err = new Error("failed to generate SVG");
    jest.mocked(composeAvatarSVG).mockImplementation(() => {
      throw err;
    });

    const svgSignal = _createAvatarSvgState({
      avatarDataState: signal({
        type: DataStateType.LOADED,
        avatar: {},
      } as unknown as AvatarDataState),
      controlsState: signal({
        ...DEFAULT_CONTROLS_STATE,
        imageStyle: ImageStyleType.NO_BG,
      }),
    });

    await waitFor(async () => {
      expect(svgSignal.value).not.toBeUndefined();
    });
    expect(svgSignal.value).toEqual(err);
  });

  test.each`
    imageStyle                        | svgVariantFn
    ${ImageStyleType.STANDARD}        | ${createStandardAvatarSVG}
    ${ImageStyleType.NFT_CARD}        | ${createNFTCardAvatarSVG}
    ${ImageStyleType.HEADSHOT_CIRCLE} | ${createHeadshotCircleAvatarSVG}
    ${ImageStyleType.HEADSHOT_HEX}    | ${createHeadshotCommentsAvatarSVG}
  `(
    "handles failure to generate styled SVG variant",
    async ({
      imageStyle,
      svgVariantFn,
    }: {
      imageStyle: ImageStyleType;
      svgVariantFn: (...args: unknown[]) => unknown;
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
        controlsState: signal({ ...DEFAULT_CONTROLS_STATE, imageStyle }),
      });

      await waitFor(async () => {
        expect(svgSignal.value).not.toBeUndefined();
      });
      expect(svgSignal.value).toEqual(err);
    }
  );
  test.each`
    imageStyle                        | svgVariantFn
    ${ImageStyleType.STANDARD}        | ${createStandardAvatarSVG}
    ${ImageStyleType.NO_BG}           | ${undefined}
    ${ImageStyleType.NFT_CARD}        | ${createNFTCardAvatarSVG}
    ${ImageStyleType.HEADSHOT_CIRCLE} | ${createHeadshotCircleAvatarSVG}
    ${ImageStyleType.HEADSHOT_HEX}    | ${createHeadshotCommentsAvatarSVG}
  `(
    "generates SVG",
    async ({
      imageStyle,
      svgVariantFn,
    }: {
      imageStyle: ImageStyleType;
      svgVariantFn: (...args: unknown[]) => unknown;
    }) => {
      // const mockComposedSvg = document.createElementNS(SVGNS, "svg");
      // const mockStyledSvg = document.createElementNS(SVGNS, "svg");
      const mockComposedSvg = parseSVG(
        `<svg xmlns="${SVGNS}" data-testid="composed"/>`
      );
      const mockStyledSvg = parseSVG(
        `<svg xmlns="${SVGNS}" data-testid="styled"/>`
      );
      jest.mocked(composeAvatarSVG).mockReturnValue(mockComposedSvg);
      if (imageStyle !== ImageStyleType.NO_BG) {
        jest.mocked(svgVariantFn).mockReturnValue(mockStyledSvg);
      }

      const svgSignal = _createAvatarSvgState({
        avatarDataState: signal({
          type: DataStateType.LOADED,
          avatar: { nftInfo: {} },
        } as unknown as AvatarDataState),
        controlsState: signal({ ...DEFAULT_CONTROLS_STATE, imageStyle }),
      });

      await waitFor(async () => {
        expect(svgSignal.value).not.toBeUndefined();
      });
      assert(svgSignal.value instanceof SVGElement);
      expect(svgSignal.value.outerHTML).toEqual(
        imageStyle === ImageStyleType.NO_BG
          ? `<svg xmlns="http://www.w3.org/2000/svg" data-testid="composed"/>`
          : `<svg xmlns="http://www.w3.org/2000/svg" data-testid="styled"/>`
      );
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
      ...DEFAULT_CONTROLS_STATE,
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

  test("is disabled unless avatarDataState is LOADED", async () => {
    const {
      state: { avatarDataState, controlsState },
      renderWithStateContext,
    } = statefulElementRenderer(
      <ImageStyleOption
        name={ImageStyleType.HEADSHOT_CIRCLE}
        title="The Title"
        description="A description."
      />
    );

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.HEADSHOT_CIRCLE,
    };

    for (const stateType of [
      DataStateType.BEFORE_LOAD,
      DataStateType.LOADING,
      DataStateType.ERROR,
    ]) {
      avatarDataState.value.type = stateType;
      renderWithStateContext();
      expect(
        await screen.findByLabelText("The Title", { exact: false })
      ).toBeDisabled();
      cleanup();
    }

    avatarDataState.value.type = DataStateType.LOADED;
    renderWithStateContext();
    expect(
      await screen.findByLabelText("The Title", { exact: false })
    ).not.toBeDisabled();
  });
});

test("<AvatarSVG>", async () => {
  render(
    <AvatarSVG svg={parseSVG(`<svg xmlns="${SVGNS}" data-testid="foo"/>`)} />
  );
  const insertedSvg = await screen.findByTestId("foo");
  expect(insertedSvg).toBeTruthy();
});

describe("<CouldNotLoadAvatarMessage>", () => {
  test("logs errors ONCE with console.error", async () => {
    jest.mocked(console.error).mockImplementation(() => undefined);
    const title = signal("Initial Title");
    function TitleChanger(): JSX.Element {
      return (
        <CouldNotLoadAvatarMessage
          title={title.value}
          logErrorContextMessage="This is what happened: "
          logError={new Error("Something broke.")}
        >
          <p>Child element.</p>
        </CouldNotLoadAvatarMessage>
      );
    }

    render(<TitleChanger />);
    await screen.findByText("Initial Title");
    await screen.findByText("Child element.");
    expect(console.error).toHaveBeenCalledTimes(1);
    // Re-render — the error is not logged again
    title.value = "New Title";
    await screen.findByText("New Title");
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});

describe("<ErrorBoundary>", () => {
  test("reports errors to errorState signal", () => {
    const errorState = signal<Error | undefined>(undefined);
    function FailingComponent(): JSX.Element {
      if (errorState.value === undefined) {
        throw new Error("FailingComponent failed.");
      }
      return <Fragment />;
    }
    render(
      <ErrorBoundary errorState={errorState}>
        <FailingComponent />
      </ErrorBoundary>
    );
    expect(errorState.value).toEqual(new Error("FailingComponent failed."));
  });
});

describe("<DownloadImageButton>", () => {
  beforeEach(() => {
    jest
      .spyOn(_internals, "_getAvatarFilename")
      .mockReturnValueOnce("example at time 1.img")
      .mockReturnValueOnce("example at time 2.img");
  });
  afterEach(() => {
    jest.mocked(_internals._getAvatarFilename).mockRestore();
  });

  test.each`
    format                   | extension | label
    ${OutputImageFormat.PNG} | ${"png"}  | ${"Download Image"}
    ${OutputImageFormat.SVG} | ${"svg"}  | ${"Download SVG Image"}
  `(
    "is disabled until state is available",
    async (options: {
      format: OutputImageFormat;
      extension: string;
      label: string;
    }) => {
      const {
        renderWithStateContext,
        state: { controlsState, outputImageState, avatarDataState },
      } = statefulElementRenderer(<DownloadImageButton />);
      renderWithStateContext();

      let button = await screen.findByRole("button");
      expect(button).toHaveAttribute("aria-disabled");
      expect(button).toHaveAttribute("href", "#");
      expect(button).not.toHaveAttribute("download");

      avatarDataState.value = { type: DataStateType.LOADED } as AvatarDataState;
      controlsState.value = {
        ...DEFAULT_CONTROLS_STATE,
        imageStyle: ImageStyleType.STANDARD,
        outputImageFormat: options.format,
      };
      outputImageState.value = {
        format: options.format,
        mimeType: "image/foo",
        blob: new Blob([]),
        url: "example://0",
      };

      await waitFor(async () => {
        expect(button).not.toHaveAttribute("aria-disabled");
      });
      button = await screen.findByRole("button", {
        name: options.label,
      });
      expect(button).toHaveAttribute("download", `example at time 1.img`);
      expect(button.getAttribute("href")).toBe("example://0");
    }
  );

  test("updates the download filename to the current time when clicked", async () => {
    const {
      renderWithStateContext,
      state: { controlsState, outputImageState, avatarDataState },
    } = statefulElementRenderer(<DownloadImageButton />);
    renderWithStateContext();

    avatarDataState.value = {
      type: DataStateType.LOADED,
      avatar: {},
    } as AvatarDataState;
    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.STANDARD,
      outputImageFormat: OutputImageFormat.PNG,
    };
    outputImageState.value = {
      format: OutputImageFormat.PNG,
      mimeType: "image/foo",
      blob: new Blob([]),
      url: "example://0",
    };

    const button = await screen.getByRole("button");

    // Hack: JSDom asynchronously logs an error if it tries to navigate as a
    // result of a click on an <a> occurring. So cancel the event to avoid this.
    button.addEventListener("click", (e) => {
      e.preventDefault();
    });

    await waitFor(async () => {
      expect(button).not.toHaveAttribute("aria-disabled");
    });
    expect(button).toHaveAttribute("download", `example at time 1.img`);
    fireEvent.click(button);
    expect(button).toHaveAttribute("download", `example at time 2.img`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });
});

describe("Avatar Image Download Filename", () => {
  test.each`
    inputTime                     | formattedTime
    ${"2023-10-23T19:30:34.819Z"} | ${"2023-10-23 at 19.30.34"}
    ${"2023-01-02T03:04:05.819Z"} | ${"2023-01-02 at 03.04.05"}
  `(
    "_formatTimeForFilename() formats $inputTime as $formattedTime",
    async (options: { inputTime: string; formattedTime: string }) => {
      const timestamp = Date.parse(options.inputTime);

      expect(_internals._formatTimeForFilename(timestamp)).toEqual(
        options.formattedTime
      );
    }
  );

  test("Download Filename has expected format", async () => {
    const controlsState: ControlsStateObject = {
      ...DEFAULT_CONTROLS_STATE,
    };
    const avatar: ResolvedAvatar = {
      accessories: [],
      styles: [],
      nftInfo: undefined,
    };
    const timestamp = Date.parse("2023-01-23T09:30:34.819Z");

    expect(
      _internals._getAvatarFilename({ controlsState, avatar, timestamp })
    ).toMatchInlineSnapshot(
      `"Reddit Avatar Standard 2023-01-23 at 09.30.34.png"`
    );

    controlsState.outputImageFormat = OutputImageFormat.SVG;
    controlsState.imageStyle = ImageStyleType.NFT_CARD;
    avatar.nftInfo = { name: "Super Rare #1" } as NFTInfo;

    expect(
      _internals._getAvatarFilename({ controlsState, avatar, timestamp })
    ).toMatchInlineSnapshot(
      `"Super Rare #1 NFT Card 2023-01-23 at 09.30.34.svg"`
    );
  });
});

describe("<CopyImageButton>", () => {
  class MockClipboardItem implements ClipboardItem {
    // eslint-disable-next-line no-useless-constructor
    constructor(
      public items: Record<string, string | Blob | PromiseLike<string | Blob>>
    ) {}
    get types(): readonly string[] {
      throw new Error("not implemented");
    }
    async getType(): Promise<Blob> {
      throw new Error("not implemented");
    }
  }
  beforeEach(() => {
    // jsdom doesn't implement the clipboard API
    assert(navigator.clipboard === undefined);
    assert(global.ClipboardItem === undefined);
    Object.assign(navigator, {
      clipboard: {
        write: jest.fn().mockResolvedValue(undefined),
      },
    });
    global.ClipboardItem = MockClipboardItem;
  });
  afterEach(() => {
    Object.assign(navigator, {
      clipboard: undefined,
    });
    global.ClipboardItem = undefined as unknown as typeof ClipboardItem;
  });

  test.each`
    format
    ${OutputImageFormat.PNG}
    ${OutputImageFormat.SVG}
  `(
    "is disabled until state is available",
    async (options: { format: OutputImageFormat; extension: string }) => {
      const {
        renderWithStateContext,
        state: { controlsState, outputImageState },
      } = statefulElementRenderer(<CopyImageButton />);
      renderWithStateContext();

      let button = await screen.findByRole("button", {
        name: `Copy Image`,
      });
      expect(button).toBeDisabled();

      controlsState.value = {
        ...DEFAULT_CONTROLS_STATE,
        imageStyle: ImageStyleType.STANDARD,
        outputImageFormat: options.format,
      };
      outputImageState.value = {
        format: options.format,
        mimeType: "image/foo",
        blob: new Blob([]),
        url: "example://0",
      };

      await waitFor(async () => {
        expect(button).not.toBeDisabled();
      });
      button = await screen.findByRole("button", {
        name: `Copy Image`,
      });
    }
  );

  test.each`
    format
    ${OutputImageFormat.PNG}
    ${OutputImageFormat.SVG}
  `(
    "copies the output image when clicked",
    async (options: { format: OutputImageFormat; extension: string }) => {
      const {
        renderWithStateContext,
        state: { controlsState, outputImageState },
      } = statefulElementRenderer(<CopyImageButton />);
      controlsState.value = {
        ...DEFAULT_CONTROLS_STATE,
        imageStyle: ImageStyleType.STANDARD,
        outputImageFormat: options.format,
      };
      const blob = new Blob([], { type: "image/foo" });
      outputImageState.value = {
        format: options.format,
        mimeType: blob.type,
        blob,
        url: "example://0",
      };
      renderWithStateContext();

      const button = await screen.findByRole("button", {
        name: `Copy Image`,
      });
      fireEvent.click(button);

      await waitFor(async () => {
        expect(navigator.clipboard.write).toBeCalledTimes(1);
        const [[[clipboardItem]]] = jest.mocked(navigator.clipboard.write).mock
          .calls;
        assert(clipboardItem instanceof MockClipboardItem);
        expect(clipboardItem.items["image/foo"]).toBe(blob);
      });
    }
  );
});

function statefulElementRenderer(children: ComponentChildren): {
  state: RootState;
  renderWithStateContext: () => void;
} {
  const avatarDataState = signal<AvatarDataState>({
    type: DataStateType.BEFORE_LOAD,
  });
  const controlsState = signal<ControlsState>(undefined);
  const avatarSvgState = signal<AvatarSVGState>(undefined);
  const outputImageState = signal<OutputImageState>(undefined);
  const analyticsStateSignal = signal<AnalyticsState>(posthog);

  const renderWithStateContext = () =>
    render(
      <AvatarDataContext.Provider value={avatarDataState}>
        <ControlsContext.Provider value={controlsState}>
          <AvatarSvgContext.Provider value={avatarSvgState}>
            <OutputImageContext.Provider value={outputImageState}>
              <AnalyticsContext.Provider value={analyticsStateSignal}>
                {children}
              </AnalyticsContext.Provider>
            </OutputImageContext.Provider>
          </AvatarSvgContext.Provider>
        </ControlsContext.Provider>
      </AvatarDataContext.Provider>
    );
  return {
    state: { avatarDataState, controlsState, avatarSvgState, outputImageState },
    renderWithStateContext,
  };
}

describe("<DisplayArea>", () => {
  test("displays loading indicator prior to being fully-loaded", async () => {
    const {
      state: { avatarDataState, controlsState, avatarSvgState },
      renderWithStateContext,
    } = statefulElementRenderer(<DisplayArea />);

    renderWithStateContext();
    await screen.findByRole("progressbar");
    cleanup();

    avatarDataState.value = { type: DataStateType.LOADING };
    renderWithStateContext();
    await screen.findByRole("progressbar");
    cleanup();

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.STANDARD,
    };
    renderWithStateContext();
    await screen.findByRole("progressbar");
    cleanup();

    avatarDataState.value = {
      type: DataStateType.LOADED,
    } as unknown as AvatarDataState;
    avatarSvgState.value = parseSVG(`<svg xmlns="${SVGNS}"/>`);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  // eslint-disable-next-line jest/expect-expect
  test("displays Avatar SVG when fully-loaded", async () => {
    const {
      state: { avatarDataState, controlsState, avatarSvgState },
      renderWithStateContext,
    } = statefulElementRenderer(<DisplayArea />);

    avatarDataState.value = {
      type: DataStateType.LOADED,
    } as unknown as AvatarDataState;
    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.STANDARD,
    };
    avatarSvgState.value = parseSVG(`<svg xmlns="${SVGNS}"/>`);

    renderWithStateContext();
    await screen.findByTestId("avatar");
  });

  // eslint-disable-next-line jest/expect-expect
  test("displays error when in failed AvatarDataState", async () => {
    const {
      state: { avatarDataState },
      renderWithStateContext,
    } = statefulElementRenderer(<DisplayArea />);

    avatarDataState.value = {
      type: DataStateType.ERROR,
      error: {
        type: AvatarDataErrorType.NOT_REDDIT_TAB,
        tab: {} as chrome.tabs.Tab,
      },
    };
    renderWithStateContext();
    await screen.findByTestId("error");
    await cleanup();
  });

  test("displays error when in failed OutputImageState", async () => {
    jest.mocked(console.error).mockImplementationOnce(() => undefined);
    const {
      state: { outputImageState },
      renderWithStateContext,
    } = statefulElementRenderer(<DisplayArea />);

    outputImageState.value = new Error("oops");
    renderWithStateContext();
    const errorContainer = await screen.findByTestId("error");
    expect(errorContainer).toHaveTextContent(
      "Headgear hit an error while generating the image to be downloaded/copied."
    );
    expect(console.error).toBeCalled();
    await cleanup();
  });
});

describe("<Controls>", () => {
  test("changes image style state when style option buttons are clicked", async () => {
    const {
      state: { avatarDataState, controlsState },
      renderWithStateContext,
    } = statefulElementRenderer(<Controls />);

    avatarDataState.value = {
      type: DataStateType.LOADED,
      avatar: { nftInfo: {} },
    } as unknown as AvatarDataState;
    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.STANDARD,
    };
    renderWithStateContext();

    let button = await screen.findByLabelText("NFT Card", { exact: false });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(controlsState.value.imageStyle).toBe(ImageStyleType.NFT_CARD);

    button = await screen.findByLabelText("Standard", { exact: false });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(controlsState.value.imageStyle).toBe(ImageStyleType.STANDARD);

    button = await screen.findByLabelText("No Background", { exact: false });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(controlsState.value.imageStyle).toBe(ImageStyleType.NO_BG);

    button = await screen.findByLabelText("UI Headshot", { exact: false });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(controlsState.value.imageStyle).toBe(ImageStyleType.HEADSHOT_CIRCLE);

    button = await screen.findByLabelText("Comment Headshot", {
      exact: false,
    });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(controlsState.value.imageStyle).toBe(ImageStyleType.HEADSHOT_HEX);
  });

  test("Settings button toggles the Image Options UI", async () => {
    const {
      state: { controlsState },
      renderWithStateContext,
    } = statefulElementRenderer(<Controls />);

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageOptionsUIOpen: false,
    };
    renderWithStateContext();
    const settingsBtn = await screen.findByRole("button", { name: "Settings" });
    fireEvent.click(settingsBtn);
    expect(controlsState.value.imageOptionsUIOpen).toBeTruthy();
    fireEvent.click(settingsBtn);
    expect(controlsState.value.imageOptionsUIOpen).toBeFalsy();
  });

  test("Copy button is not shown for SVG image output", async () => {
    const {
      state: { controlsState },
      renderWithStateContext,
    } = statefulElementRenderer(<Controls />);

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      outputImageFormat: OutputImageFormat.PNG,
    };
    renderWithStateContext();

    expect(
      await screen.queryByRole("button", { name: "Copy Image" })
    ).not.toBeNull();

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      outputImageFormat: OutputImageFormat.SVG,
    };
    await waitFor(async () => {
      expect(
        await screen.queryByRole("button", { name: "Copy Image" })
      ).toBeNull();
    });
  });
});

describe("<OutputImageScaleRadio>", () => {
  // eslint-disable-next-line jest/expect-expect
  test("displays scaled image size", async () => {
    const {
      state: { avatarSvgState },
      renderWithStateContext,
    } = statefulElementRenderer(
      <OutputImageScaleRadio
        scale={3}
        label="Huge"
        value={RasterImageSize.XLARGE}
      />
    );
    renderWithStateContext();
    await screen.getByLabelText("? \u00d7 ? pixels", { exact: false });

    avatarSvgState.value = parseSVG(
      `<svg xmlns="${SVGNS}" viewBox="0 0 10 20"/>`
    );
    await waitFor(async () => {
      await screen.getByLabelText("30 \u00d7 60 pixels", { exact: false });
    });
  });
});

describe("<ImageOptions>", () => {
  test("dialog opens and closes with state", async () => {
    const {
      state: { controlsState },
      renderWithStateContext,
    } = statefulElementRenderer(<ImageOptions />);

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageOptionsUIOpen: false,
    };
    renderWithStateContext();
    expect(
      await screen.queryByRole("dialog", { name: "Image Output Options" })
    ).toBeNull();

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageOptionsUIOpen: true,
    };
    await screen.findByRole("dialog", {
      name: "Image Output Options",
    });

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageOptionsUIOpen: false,
    };
    await waitFor(async () => {
      expect(
        await screen.queryByRole("dialog", { name: "Image Output Options" })
      ).toBeNull();
    });
  });

  test("clicking the close button closes the dialog", async () => {
    const {
      state: { controlsState },
      renderWithStateContext,
    } = statefulElementRenderer(<ImageOptions />);

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageOptionsUIOpen: true,
    };
    renderWithStateContext();
    const dialog = await screen.getByRole("dialog", {
      name: "Image Output Options",
    });
    const closeBtn = await within(dialog).getByRole("button", {
      name: "Close",
    });
    fireEvent.click(closeBtn);
    expect(
      await screen.queryByRole("dialog", {
        name: "Image Output Options",
      })
    ).toBeNull();
  });

  test("clicking the modal background closes the dialog", async () => {
    const {
      state: { controlsState },
      renderWithStateContext,
    } = statefulElementRenderer(<ImageOptions />);

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageOptionsUIOpen: true,
    };
    renderWithStateContext();
    await screen.queryByRole("dialog", { name: "Image Output Options" });
    const background = await screen.getByTestId("modal-bg");
    fireEvent.click(background);
    expect(
      await screen.queryByRole("dialog", {
        name: "Image Output Options",
      })
    ).toBeNull();
  });

  test.each`
    name               | value
    ${"Vector Images"} | ${OutputImageFormat.SVG}
    ${"Normal Images"} | ${OutputImageFormat.PNG}
  `(
    "Sets $name format when clicking its radio button",
    async (options: { name: string; value: OutputImageFormat }) => {
      const {
        state: { controlsState },
        renderWithStateContext,
      } = statefulElementRenderer(<ImageOptions />);

      controlsState.value = {
        ...DEFAULT_CONTROLS_STATE,
        imageOptionsUIOpen: true,
      };
      renderWithStateContext();
      const radio = await screen.getByLabelText(options.name);
      fireEvent.click(radio);
      await waitFor(() => {
        expect(controlsState.value?.outputImageFormat).toBe(options.value);
      });
    }
  );

  test.each`
    name         | value
    ${"Small"}   | ${RasterImageSize.SMALL}
    ${"Medium"}  | ${RasterImageSize.MEDIUM}
    ${/^Large/}  | ${RasterImageSize.LARGE}
    ${"X-Large"} | ${RasterImageSize.XLARGE}
  `(
    "Sets $name size when clicking its radio button",
    async (options: { name: string; value: RasterImageSize }) => {
      const {
        state: { controlsState },
        renderWithStateContext,
      } = statefulElementRenderer(<ImageOptions />);

      controlsState.value = {
        ...DEFAULT_CONTROLS_STATE,
        imageOptionsUIOpen: true,
        outputImageFormat: OutputImageFormat.SVG,
        rasterImageSize: RasterImageSize.EXACT_HEIGHT,
      };
      renderWithStateContext();
      const radio = await screen.getByLabelText(options.name, { exact: false });
      fireEvent.click(radio);
      await waitFor(() => {
        expect(controlsState.value?.rasterImageSize).toBe(options.value);
      });
      // Format automatically switches to PNG when changing raster image size.
      expect(controlsState.value.outputImageFormat).toBe(OutputImageFormat.PNG);
    }
  );

  test.each`
    name        | value
    ${"Width"}  | ${RasterImageSize.EXACT_WIDTH}
    ${"Height"} | ${RasterImageSize.EXACT_HEIGHT}
  `(
    "Sets exact $name size when clicking and filling its input",
    async (options: { name: string; value: RasterImageSize }) => {
      const {
        state: { controlsState },
        renderWithStateContext,
      } = statefulElementRenderer(<ImageOptions />);

      controlsState.value = {
        ...DEFAULT_CONTROLS_STATE,
        imageOptionsUIOpen: true,
      };
      renderWithStateContext();
      const input = await screen.getByLabelText(options.name, { exact: false });
      assert(input instanceof HTMLInputElement);
      fireEvent.click(input);
      await waitFor(() => {
        expect(controlsState.value?.rasterImageSize).toBe(options.value);
      });

      input.value = "1234";
      fireEvent.blur(input);
      await waitFor(() => {
        expect(
          options.value === RasterImageSize.EXACT_WIDTH
            ? controlsState.value?.rasterImageExactWidth
            : controlsState.value?.rasterImageExactHeight
        ).toBe(1234);
      });
    }
  );

  test('The "Usage Sharing Options" button opens the Usage Sharing Consent popup', async () => {
    const {
      state: { controlsState },
      renderWithStateContext,
    } = statefulElementRenderer(<ImageOptions />);

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageOptionsUIOpen: true,
    };
    renderWithStateContext();
    expect(controlsState.value.analyticsConsentUIOpen).toBeFalsy();

    fireEvent.click(
      await screen.getByRole("button", { name: "Usage Sharing Options" })
    );

    await waitFor(() => {
      expect(controlsState.value?.analyticsConsentUIOpen).toBeTruthy();
    });
  });
});

describe("_createOutputImageState()", () => {
  let controlsState = signal<ControlsState>(undefined);
  let avatarSvgState = signal<AvatarSVGState>(undefined);
  let revokeObjectURL: jest.Mock<void, [string]>;
  let blobs: Map<string, Blob>;
  beforeEach(() => {
    controlsState = signal<ControlsState>(undefined);
    avatarSvgState = signal<AvatarSVGState>(undefined);
    blobs = new Map();
    let urlId = 0;
    // jsdom doesn't implement these
    assert(URL.createObjectURL === undefined);
    assert(URL.revokeObjectURL === undefined);
    URL.createObjectURL = jest.fn().mockImplementation((blob) => {
      const url = `example://${urlId++}`;
      blobs.set(url, blob as Blob);
      return url;
    });
    URL.revokeObjectURL = revokeObjectURL = jest
      .fn()
      .mockImplementation(() => undefined);
    jest
      .mocked(rasteriseSVG)
      .mockImplementation(async ({ svg, width, height }) => {
        await new Promise((resolve) => {
          setTimeout(resolve, 20);
        });
        return new Blob(
          [
            `mock PNG width: ${width}, height: ${height}, `,
            `svg testid: ${svg.getAttribute("data-testid")}`,
          ],
          { type: "image/png" }
        );
      });
  });

  afterEach(() => {
    URL.createObjectURL = undefined as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = undefined as unknown as typeof URL.revokeObjectURL;
  });

  test("creates and subsequently updates SVG image", async () => {
    const outputImage = _createOutputImageState({
      avatarSvgState,
      controlsState,
    });

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      outputImageFormat: OutputImageFormat.SVG,
    };
    const svgSrc1 = `<svg viewBox="0 0 10 16" data-testid="example1" xmlns="${SVGNS}"/>`;
    const svgSrc2 = `<svg viewBox="0 0 10 16" data-testid="example2" xmlns="${SVGNS}"/>`;
    avatarSvgState.value = parseSVG(svgSrc1);

    await waitFor(async () => {
      expect(outputImage.value).toEqual({
        format: OutputImageFormat.SVG,
        mimeType: "image/svg+xml",
        blob: blobs.get("example://0"),
        url: "example://0",
      });
      expect(await readBlobAsText(blobs.get("example://0") as Blob)).toEqual(
        svgSrc1
      );
    });

    avatarSvgState.value = parseSVG(svgSrc2);

    await waitFor(async () => {
      expect(outputImage.value).toEqual({
        format: OutputImageFormat.SVG,
        mimeType: "image/svg+xml",
        blob: blobs.get("example://1"),
        url: "example://1",
      });
      expect(await readBlobAsText(blobs.get("example://1") as Blob)).toEqual(
        svgSrc2
      );
    });
  });

  test("creates and subsequently updates PNG image", async () => {
    const outputImage = _createOutputImageState({
      avatarSvgState,
      controlsState,
    });

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      outputImageFormat: OutputImageFormat.PNG,
    };
    const svgSrc1 = `<svg viewBox="0 0 10 16" data-testid="example1" xmlns="${SVGNS}"/>`;
    const svgSrc2 = `<svg viewBox="0 0 10 16" data-testid="example2" xmlns="${SVGNS}"/>`;
    avatarSvgState.value = parseSVG(svgSrc1);

    await waitFor(async () => {
      expect(outputImage.value).toEqual({
        format: OutputImageFormat.PNG,
        mimeType: "image/png",
        blob: blobs.get("example://0"),
        url: "example://0",
      });
      expect(await readBlobAsText(blobs.get("example://0") as Blob)).toEqual(
        "mock PNG width: 20, height: 32, svg testid: example1"
      );
    });

    avatarSvgState.value = parseSVG(svgSrc2);
    controlsState.value = {
      ...controlsState.value,
      rasterImageSize: RasterImageSize.EXACT_WIDTH,
      rasterImageExactWidth: 100,
    };

    await waitFor(async () => {
      expect(revokeObjectURL.mock.calls).toEqual([["example://0"]]);
      expect(outputImage.value).toEqual({
        format: OutputImageFormat.PNG,
        mimeType: "image/png",
        blob: blobs.get("example://1"),
        url: "example://1",
      });
      expect(await readBlobAsText(blobs.get("example://1") as Blob)).toEqual(
        "mock PNG width: 100, height: 160, svg testid: example2"
      );
    });
  });

  test("skips pending render requests superseded by more recent requests", async () => {
    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      outputImageFormat: OutputImageFormat.PNG,
      rasterImageSize: RasterImageSize.EXACT_WIDTH,
      rasterImageExactWidth: 500,
    };
    const svgSrc = `<svg viewBox="0 0 10 10" data-testid="example1" xmlns="${SVGNS}"/>`;
    avatarSvgState.value = parseSVG(svgSrc);

    const outputImage = _createOutputImageState({
      avatarSvgState,
      controlsState,
    });

    for (let i = 0; i < 10; ++i) {
      controlsState.value = {
        ...controlsState.value,
        rasterImageExactWidth: 1000 + i,
      };
    }

    await waitFor(async () => {
      expect(outputImage.value).toEqual({
        format: OutputImageFormat.PNG,
        mimeType: "image/png",
        blob: blobs.get("example://0"),
        url: "example://0",
      });
      expect(await readBlobAsText(blobs.get("example://0") as Blob)).toEqual(
        "mock PNG width: 1009, height: 1009, svg testid: example1"
      );
    });

    // The jobs are executed asynchronously and aborted if another job has been
    // queued since an earlier job was created, so we only render the image
    // once, despite triggering several state changes.
    expect(rasteriseSVG).toBeCalledTimes(1);
    expect(rasteriseSVG).toBeCalledWith({
      svg: avatarSvgState.value,
      width: 1009,
      height: 1009,
    });
  });

  test("propagates error from SVG creation", async () => {
    const outputImage = _createOutputImageState({
      avatarSvgState,
      controlsState,
    });
    avatarSvgState.value = new Error("Failed to create Avatar SVG");
    await waitFor(() => {
      expect(
        outputImage.value instanceof Error && outputImage.value.message
      ).toBe("Failed to create Avatar SVG");
    });
  });
});

describe("_measureScaledSVG()", () => {
  test("throws if viewBox is invalid", () => {
    expect(() =>
      _getBaseSize(parseSVG(`<svg viewBox="foo" xmlns="${SVGNS}"/>`))
    ).toThrow("svg viewBox attribute is invalid: foo");
  });

  test.each`
    viewBox        | controlsState                                                                    | expectedSize
    ${"0 0 10 20"} | ${{ rasterImageSize: RasterImageSize.SMALL }}                                    | ${{ width: 10, height: 20 }}
    ${"0 0 10 20"} | ${{ rasterImageSize: RasterImageSize.MEDIUM }}                                   | ${{ width: 20, height: 40 }}
    ${"0 0 10 20"} | ${{ rasterImageSize: RasterImageSize.LARGE }}                                    | ${{ width: 30, height: 60 }}
    ${"0 0 10 20"} | ${{ rasterImageSize: RasterImageSize.XLARGE }}                                   | ${{ width: 40, height: 80 }}
    ${"0 0 10 20"} | ${{ rasterImageSize: RasterImageSize.EXACT_WIDTH, rasterImageExactWidth: 12 }}   | ${{ width: 12, height: 24 }}
    ${"0 0 10 20"} | ${{ rasterImageSize: RasterImageSize.EXACT_HEIGHT, rasterImageExactHeight: 24 }} | ${{ width: 12, height: 24 }}
  `(
    'measures SVG with viewBox="$viewBox" with size $controlsState as $expectedSize',
    ({
      viewBox,
      controlsState,
      expectedSize,
    }: {
      viewBox: string;
      controlsState: ControlsStateObject;
      expectedSize: { width: number; height: number };
    }) => {
      const svg = parseSVG(`<svg viewBox="${viewBox}" xmlns="${SVGNS}"/>`);
      expect(_measureScaledSVG({ svg, controlsState })).toEqual(expectedSize);
    }
  );
});

test("_getBaseSize()", () => {
  expect(() =>
    _getBaseSize(parseSVG(`<svg viewBox="foo" xmlns="${SVGNS}"/>`))
  ).toThrow("svg viewBox attribute is invalid: foo");
  expect(
    _getBaseSize(parseSVG(`<svg viewBox="0 0 10 20" xmlns="${SVGNS}"/>`))
  ).toEqual({ width: 10, height: 20 });
});

describe("_initAnalyticsState", () => {
  beforeEach(() => {
    resetMockPostHog(posthog);
  });
  const setupElementWithUndefinedState = () => {
    const analyticsStateSignal = signal<AnalyticsState>(undefined);
    const controlsStateSignal = signal<ControlsState>(undefined);
    _initAnalyticsState({ analyticsStateSignal, controlsStateSignal });

    expect(analyticsStateSignal.value).toBeUndefined();
    expect(posthog.init).not.toHaveBeenCalled();
    return { analyticsStateSignal, controlsStateSignal };
  };
  describe("when user has previously provided an analytics consent decision", () => {
    test("when a user is opted in, posthog.init() is called on load", async () => {
      const { analyticsStateSignal, controlsStateSignal } =
        setupElementWithUndefinedState();

      controlsStateSignal.value = {
        ...DEFAULT_CONTROLS_STATE,
        analyticsPreference: AnalyticsPreference.OPTED_IN,
      };
      await waitFor(() => {
        expect(analyticsStateSignal.value).not.toBeUndefined();
        expect(posthog.init).toHaveBeenCalled();
        // We don't opt in because we were never opted out.
        expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
        expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
      });
    });

    test("when running in an incognito window, analytics is not enabled, even if a user is opted in", async () => {
      jest.mocked(getIsIncognitoSignal).mockReturnValueOnce(signal(true));
      const { analyticsStateSignal, controlsStateSignal } =
        setupElementWithUndefinedState();

      controlsStateSignal.value = {
        ...DEFAULT_CONTROLS_STATE,
        analyticsPreference: AnalyticsPreference.OPTED_IN,
      };
      await waitFor(() => {
        expect(analyticsStateSignal.value).toBeUndefined();
        expect(posthog.init).not.toHaveBeenCalled();
        expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
        expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
      });
    });

    test("when a user is opted out, posthog.init() is not called on load", async () => {
      const { analyticsStateSignal, controlsStateSignal } =
        setupElementWithUndefinedState();

      controlsStateSignal.value = {
        ...DEFAULT_CONTROLS_STATE,
        analyticsPreference: AnalyticsPreference.OPTED_OUT,
      };
      await await new Promise((r) => setTimeout(r, 100));
      expect(analyticsStateSignal.value).toBeUndefined();
      expect(posthog.init).not.toHaveBeenCalled();
      expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
      // We don't opt out because we never actually init() when a user is opted
      // out.
      expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
    });
  });

  describe("when user is yet to provide an analytics consent decision", () => {
    test("posthog.init() is only called after a user consents to analytics", async () => {
      const { analyticsStateSignal, controlsStateSignal } =
        setupElementWithUndefinedState();

      controlsStateSignal.value = {
        ...DEFAULT_CONTROLS_STATE,
        analyticsPreference: AnalyticsPreference.NOT_YET_DECIDED,
      };
      await await new Promise((r) => setTimeout(r, 100));
      expect(analyticsStateSignal.value).toBeUndefined();
      expect(posthog.init).not.toHaveBeenCalled();

      // consent is granted
      controlsStateSignal.value = {
        ...DEFAULT_CONTROLS_STATE,
        analyticsPreference: AnalyticsPreference.OPTED_IN,
      };
      await waitFor(() => {
        expect(analyticsStateSignal.value).not.toBeUndefined();
        expect(posthog.init).toHaveBeenCalled();
        expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
        expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
      });
    });

    test("posthog.init() is not called when a user does not consent to analytics", async () => {
      const { analyticsStateSignal, controlsStateSignal } =
        setupElementWithUndefinedState();

      controlsStateSignal.value = {
        ...DEFAULT_CONTROLS_STATE,
        analyticsPreference: AnalyticsPreference.NOT_YET_DECIDED,
      };
      await await new Promise((r) => setTimeout(r, 100));

      // consent is not granted
      controlsStateSignal.value = {
        ...DEFAULT_CONTROLS_STATE,
        analyticsPreference: AnalyticsPreference.OPTED_OUT,
      };
      await await new Promise((r) => setTimeout(r, 100));

      expect(analyticsStateSignal.value).toBeUndefined();
      expect(posthog.init).not.toHaveBeenCalled();
      expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
      expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
    });
  });

  const prefChangeToggleSequence = (options: {
    from: OptInOut;
    count: number;
  }): OptInOut[] => {
    const prefs: OptInOut[] =
      options.from === AnalyticsPreference.OPTED_IN
        ? [AnalyticsPreference.OPTED_IN, AnalyticsPreference.OPTED_OUT]
        : [AnalyticsPreference.OPTED_OUT, AnalyticsPreference.OPTED_IN];
    const seq = [...new Array(options.count).keys()].map((n) => prefs[n % 2]);
    assert(options.count > 0);
    assert(seq.length === options.count);
    return seq;
  };

  test.each`
    startingPreference                     | nextPreference                   | postHogInitialCapturingPreference
    ${AnalyticsPreference.OPTED_IN}        | ${AnalyticsPreference.OPTED_OUT} | ${AnalyticsPreference.OPTED_IN}
    ${AnalyticsPreference.OPTED_OUT}       | ${AnalyticsPreference.OPTED_IN}  | ${AnalyticsPreference.OPTED_IN}
    ${AnalyticsPreference.NOT_YET_DECIDED} | ${AnalyticsPreference.OPTED_IN}  | ${AnalyticsPreference.OPTED_IN}
    ${AnalyticsPreference.NOT_YET_DECIDED} | ${AnalyticsPreference.OPTED_OUT} | ${AnalyticsPreference.OPTED_IN}
    ${AnalyticsPreference.OPTED_IN}        | ${AnalyticsPreference.OPTED_OUT} | ${AnalyticsPreference.OPTED_OUT}
    ${AnalyticsPreference.OPTED_OUT}       | ${AnalyticsPreference.OPTED_IN}  | ${AnalyticsPreference.OPTED_OUT}
    ${AnalyticsPreference.NOT_YET_DECIDED} | ${AnalyticsPreference.OPTED_IN}  | ${AnalyticsPreference.OPTED_OUT}
    ${AnalyticsPreference.NOT_YET_DECIDED} | ${AnalyticsPreference.OPTED_OUT} | ${AnalyticsPreference.OPTED_OUT}
  `(
    "User's preference is applied when toggling their share preference to $nextPreference, starting from $startingPreference, when PostHog's persisted opt-out state is $postHogInitialCapturingPreference",
    async (options: {
      startingPreference: AnalyticsPreference;
      nextPreference: OptInOut;
      postHogInitialCapturingPreference: OptInOut;
    }) => {
      resetMockPostHog(posthog, {
        capturingPreference: options.postHogInitialCapturingPreference,
      });
      expect(posthog.has_opted_in_capturing()).toBe(
        options.postHogInitialCapturingPreference ===
          AnalyticsPreference.OPTED_IN
      );
      expect(posthog.has_opted_out_capturing()).toBe(
        options.postHogInitialCapturingPreference ===
          AnalyticsPreference.OPTED_OUT
      );

      const { analyticsStateSignal, controlsStateSignal } =
        setupElementWithUndefinedState();

      const changePreference = (analyticsPreference: AnalyticsPreference) => {
        controlsStateSignal.value = {
          ...DEFAULT_CONTROLS_STATE,
          analyticsPreference,
        };
      };

      for (const preference of prefChangeToggleSequence({
        from: options.nextPreference,
        count: 4,
      })) {
        changePreference(preference);
        await waitFor(() => {
          expect(posthog.has_opted_in_capturing()).toBe(
            !posthog.has_opted_out_capturing()
          );

          /* eslint-disable jest/no-conditional-expect */
          if (preference === AnalyticsPreference.OPTED_IN) {
            expect(posthog.init).toHaveBeenCalledTimes(1);
            expect(analyticsStateSignal.value).not.toBeUndefined();
            expect(posthog.has_opted_in_capturing()).toBeTruthy();
          } else {
            expect(analyticsStateSignal.value).toBeUndefined();

            const initCalled = jest.mocked(posthog.init).mock.calls.length > 0;
            // If init hasn't been called (e.g. because we never opted in) then
            // we may not have explicitly opted-out posthog, but that's moot
            // because it's not running.
            expect(
              !initCalled || posthog.has_opted_out_capturing()
            ).toBeTruthy();

            // However if init has ever been called, then we must have
            // explicitly opted out.
            if (initCalled) {
              expect(posthog.has_opted_out_capturing()).toBeTruthy();
            }
          }
          /* eslint-enable jest/no-conditional-expect */
        });
      }
      expect(posthog.init).toHaveBeenCalledTimes(1);
    }
  );

  test("super properties are registered when enabling analytics", async () => {
    const { controlsStateSignal } = setupElementWithUndefinedState();

    controlsStateSignal.value = {
      ...DEFAULT_CONTROLS_STATE,
      analyticsPreference: AnalyticsPreference.OPTED_IN,
    };
    await waitFor(() => {
      // Mock values set automatically via jest-setup.ts and
      // src/__tests__/headgear-global.mock.ts.
      expect(posthog.register).toHaveBeenCalledWith({
        headgearDev: true,
        headgearBrowser: "chrome",
        headgearVersion: "1.2.3",
      });
    });
  });
});
