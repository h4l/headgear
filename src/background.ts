import debounce from "lodash.debounce";
import isEqual from "lodash.isequal";

import { assert } from "./assert";
import { polyfillWebExtensionsAPI } from "./compatibility";
import {
  ControlsStateObject,
  PORT_IMAGE_CONTROLS_CHANGED,
  STORAGE_KEY_IMAGE_CONTROLS,
  isControlsStateObject,
} from "./popup-state-persistence";

export function _persistImageControlsOnChange() {
  let controlsState: ControlsStateObject | undefined;

  // Debounce set() calls so that we don't trigger the storage throttle limits
  // if the user spams UI changes.
  const persistControlsState = debounce(() => {
    chrome.storage.sync
      .set({ [STORAGE_KEY_IMAGE_CONTROLS]: controlsState })
      .catch((err) => {
        console.error("failed to persist popup controls state:", err);
      });
  }, 5000);

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_IMAGE_CONTROLS_CHANGED) return;

    port.onMessage.addListener((value) => {
      assert(isControlsStateObject(value));
      if (!isEqual(controlsState, value)) {
        controlsState = value;
        persistControlsState();
      }
    });
    port.onDisconnect.addListener(() => {
      persistControlsState.flush();
    });
  });
}

export async function main() {
  polyfillWebExtensionsAPI();
  _persistImageControlsOnChange();
}
