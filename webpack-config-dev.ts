import { createConfig } from "./webpack-common";

export default [
  createConfig({ mode: "development", browser: "chrome" }),
  createConfig({ mode: "development", browser: "firefox" }),
];
