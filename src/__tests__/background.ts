import {
  MockEvent,
  MockPort,
  MockSyncStorageArea,
  mockChrome,
} from "./chrome.mock";

import { _persistImageControlsOnChange } from "../background";
import {
  ControlsStateObject,
  DEFAULT_CONTROLS_STATE,
  ImageStyleType,
  PORT_IMAGE_CONTROLS_CHANGED,
  STORAGE_KEY_IMAGE_CONTROLS,
} from "../popup-state-persistence";

describe("_persistImageControlsOnChange()", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.chrome = mockChrome();
  });

  test("debounces multiple state changes as one set()", async () => {
    const onConnect = chrome.runtime.onConnect as MockEvent<
      (port: chrome.runtime.Port) => void
    >;
    const syncStorage = chrome.storage.sync as MockSyncStorageArea;
    const port = new MockPort(PORT_IMAGE_CONTROLS_CHANGED);
    const controlsState1: ControlsStateObject = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.NFT_CARD,
    };
    const controlsState2: ControlsStateObject = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.HEADSHOT_HEX,
    };

    _persistImageControlsOnChange();
    expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledTimes(1);

    onConnect.callListeners(port);
    expect(port.onMessage.addListener).toBeCalledTimes(1);
    expect(port.onDisconnect.addListener).toBeCalledTimes(1);

    port.postMessage(controlsState1);
    port.postMessage(controlsState2);
    expect(syncStorage.set).not.toHaveBeenCalled();

    jest.runAllTimers();
    expect(syncStorage.set).toHaveBeenCalledTimes(1);
    await expect(syncStorage.get()).resolves.toEqual({
      [STORAGE_KEY_IMAGE_CONTROLS]: controlsState2,
    });
  });

  test("sets state immediately on disconnect", async () => {
    const onConnect = chrome.runtime.onConnect as MockEvent<
      (port: chrome.runtime.Port) => void
    >;
    const syncStorage = chrome.storage.sync as MockSyncStorageArea;
    const port = new MockPort(PORT_IMAGE_CONTROLS_CHANGED);
    const controlsState: ControlsStateObject = {
      ...DEFAULT_CONTROLS_STATE,
      imageStyle: ImageStyleType.NFT_CARD,
    };

    _persistImageControlsOnChange();
    onConnect.callListeners(port);
    port.postMessage(controlsState);
    expect(syncStorage.set).not.toHaveBeenCalled();

    port.disconnect();
    expect(syncStorage.set).toHaveBeenCalledTimes(1);
    await expect(syncStorage.get()).resolves.toEqual({
      [STORAGE_KEY_IMAGE_CONTROLS]: controlsState,
    });
  });
});
