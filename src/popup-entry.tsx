import { render } from "preact";

import "./css.css";
import { Headgear, createRootState } from "./popup";

const {
  avatarDataState: headgearState,
  controlsState,
  avatarSvgState,
} = createRootState();
render(
  <Headgear
    avatarDataState={headgearState}
    controlsState={controlsState}
    avatarSvgState={avatarSvgState}
  />,
  document.body
);
