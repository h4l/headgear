import { Signal, signal } from "@preact/signals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/preact";
import { ComponentChildren } from "preact";
import { Fragment, JSX } from "preact/jsx-runtime";

import { mockChrome } from "./chrome.mock";

import { assert } from "../assert";
import {
  AvatarDataContext,
  AvatarDataErrorType,
  AvatarDataState,
  AvatarSVG,
  AvatarSVGState,
  AvatarSvgContext,
  ClosePopupButton,
  Controls,
  ControlsContext,
  ControlsState,
  CouldNotLoadAvatarMessage,
  DataStateType,
  DisplayArea,
  DownloadSVGButton,
  ErrorBoundary,
  ImageOptions,
  ImageStyleOption,
  RootState,
  _createAvatarSvgState,
  _initialiseRootState,
  createRootState,
} from "../popup";
import {
  DEFAULT_CONTROLS_STATE,
  ImageStyleType,
  OutputImageFormat,
  PORT_IMAGE_CONTROLS_CHANGED,
  RasterImageSize,
  STORAGE_KEY_IMAGE_CONTROLS,
} from "../popup-state-persistence";
import { MSG_GET_AVATAR } from "../reddit-interaction";
import {
  SVGNS,
  composeAvatarSVG,
  createHeadshotCircleAvatarSVG,
  createHeadshotCommentsAvatarSVG,
  createNFTCardAvatarSVG,
  createStandardAvatarSVG,
} from "../svg";

jest.mock("../svg.ts");

beforeEach(() => {
  jest.resetAllMocks();
});

describe("create & initialise RootState", () => {
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

  test("avatarDataState becomes AVATAR_LOADED if tab is reddit", async () => {
    const mockAvatarData = { avatar: true };
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
      files: ["reddit.js"],
    });
    expect(chrome.tabs.sendMessage).toBeCalledWith(123, MSG_GET_AVATAR);
    expect(avatarDataState.value.tab).toBe(tab);
    expect(avatarDataState.value.avatar).toBe(mockAvatarData);
  });

  test("avatarDataState becomes ERROR with type GET_AVATAR_FAILED if get-avatar message responds with an error", async () => {
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
          : { ...DEFAULT_CONTROLS_STATE, imageStyle: imageStyleType };
      const svgStateSignal = _createAvatarSvgState({
        avatarDataState: signal(avatarDataState as AvatarDataState),
        controlsState: signal(controlsState),
      });
      expect(svgStateSignal.value).toBe(undefined);
    }
  );

  test("defaults to available image style if NFT style is requested with non-NFT calendar", () => {
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
    expect(svgStateSignal.value).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"/>'
    );
    expect(createStandardAvatarSVG).toHaveBeenCalledTimes(1);
  });

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
      controlsState: signal({
        ...DEFAULT_CONTROLS_STATE,
        imageStyle: ImageStyleType.NO_BG,
      }),
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
    ({
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
    ({
      imageStyle,
      svgVariantFn,
    }: {
      imageStyle: ImageStyleType;
      svgVariantFn: (...args: unknown[]) => unknown;
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
        controlsState: signal({ ...DEFAULT_CONTROLS_STATE, imageStyle }),
      });

      expect(svgSignal.value).toBe(
        imageStyle === ImageStyleType.NO_BG
          ? `<svg xmlns="http://www.w3.org/2000/svg"/>`
          : `<svg xmlns="http://www.w3.org/2000/svg" id="styled"/>`
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
  render(<AvatarSVG svg={`<svg xmlns="${SVGNS}" data-testid="foo"/>`} />);
  const insertedSvg = await screen.findByTestId("foo");
  expect(insertedSvg).toBeTruthy();
});

describe("<CouldNotLoadAvatarMessage>", () => {
  test("logs errors ONCE with console.error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
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

describe("<DownloadSVGButton>", () => {
  test("is disabled until state is available", async () => {
    const controlsState = signal<ControlsState>(undefined);
    const avatarSvgState = signal<AvatarSVGState>(undefined);
    render(
      <ControlsContext.Provider value={controlsState}>
        <AvatarSvgContext.Provider value={avatarSvgState}>
          <DownloadSVGButton />
        </AvatarSvgContext.Provider>
      </ControlsContext.Provider>
    );
    let button = await screen.findByRole("button");
    expect(button).toHaveAttribute("aria-disabled");
    expect(button).toHaveAttribute("href", "#");
    expect(button).not.toHaveAttribute("download");

    controlsState.value = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.STANDARD,
    };
    avatarSvgState.value = "<svg/>";

    await waitFor(async () => {
      button = await screen.findByRole("button");
      expect(button).not.toHaveAttribute("aria-disabled");
      expect(button).toHaveAttribute("download", "Reddit Avatar Standard.svg");
      expect(button.getAttribute("href")).toBe(
        `data:image/svg+xml;base64,${btoa("<svg/>")}`
      );
    });
  });
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

  const renderWithStateContext = () =>
    render(
      <AvatarDataContext.Provider value={avatarDataState}>
        <ControlsContext.Provider value={controlsState}>
          <AvatarSvgContext.Provider value={avatarSvgState}>
            {children}
          </AvatarSvgContext.Provider>
        </ControlsContext.Provider>
      </AvatarDataContext.Provider>
    );
  return {
    state: { avatarDataState, controlsState, avatarSvgState },
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
    avatarSvgState.value = "<svg/>";
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
    avatarSvgState.value = "<svg/>";

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
        rasterImageSize: RasterImageSize.EXACT_HEIGHT,
      };
      renderWithStateContext();
      const radio = await screen.getByLabelText(options.name, { exact: false });
      fireEvent.click(radio);
      await waitFor(() => {
        expect(controlsState.value?.rasterImageSize).toBe(options.value);
      });
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
});
