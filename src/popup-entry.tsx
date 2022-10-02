import { render } from "preact";

import "./css.css";
import { Headgear, createRootState } from "./popup";

const { headgearState, controlsState } = createRootState();
render(
  <Headgear headgearState={headgearState} controlsState={controlsState} />,
  document.body
);
