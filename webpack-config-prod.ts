import { merge } from "webpack-merge";

import commonConfig from "./webpack-common";

export default merge(commonConfig, {
  mode: "production",
  optimization: {
    // The Chrome Web Store policies prohibit code obfuscation. They do permit
    // regular minification, so we could leave minimize on. But turning it off
    // only costs ~10KB on the final zip package, and makes it easier to verify
    // the code's behaviour. So I'm going to disable minification for production
    // builds.
    // https://developer.chrome.com/docs/webstore/program_policies/#code-readability
    // https://blog.chromium.org/2018/10/trustworthy-chrome-extensions-by-default.html
    minimize: false,
  },
});
