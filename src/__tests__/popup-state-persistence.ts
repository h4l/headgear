import {
  ControlsStateObject,
  DEFAULT_CONTROLS_STATE,
  isControlsStateObject,
} from "../popup-state-persistence";

test("isControlsStateObject", () => {
  expect(isControlsStateObject(DEFAULT_CONTROLS_STATE)).toBeTruthy();
  Object.keys(DEFAULT_CONTROLS_STATE).forEach((k) => {
    const obj: Partial<ControlsStateObject> = { ...DEFAULT_CONTROLS_STATE };
    delete obj[k as keyof ControlsStateObject];
    expect(isControlsStateObject(obj)).toBeFalsy();

    obj[k as keyof ControlsStateObject] = undefined;
    expect(isControlsStateObject(obj)).toBeFalsy();
  });
});
