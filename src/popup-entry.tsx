import { render } from "preact";

import { polyfillWebExtensionsAPI } from "./compatibility";
import "./css.css";
import { App } from "./popup";

polyfillWebExtensionsAPI();
render(<App />, document.body);
