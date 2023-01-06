import { createConfig } from "./webpack-common";

export default [
  createConfig({ mode: "production", browser: "chrome" }),
  createConfig({ mode: "production", browser: "firefox" }),
];
