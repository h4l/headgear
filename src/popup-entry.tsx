import { render } from "preact";

import { Headgear, createRootState } from "./popup";

render(<Headgear rootState={createRootState()} />, document.body);
