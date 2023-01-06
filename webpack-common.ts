import CopyPlugin from "copy-webpack-plugin";
import { readFile } from "fs/promises";
import * as path from "path";
import {
  Compilation,
  Compiler,
  Configuration,
  IgnorePlugin,
  sources,
} from "webpack";
import merge from "webpack-merge";

import { assert } from "./src/assert";

type BrowserTarget = "chrome" | "firefox";
type BrowserTargetOptions = { browser: BrowserTarget };

/** Generate manifest.json */
class GenerateManifestPlugin {
  public readonly browser: BrowserTarget;
  constructor(options: BrowserTargetOptions) {
    this.browser = options.browser;
  }
  apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap("GenerateManifestPlugin", (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: "GenerateManifestPlugin",
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        async (assets) => {
          assets["manifest.json"] = await this.generateManifest({
            browser: this.browser,
          });
        }
      );
    });
  }
  async generateManifest(
    options: BrowserTargetOptions
  ): Promise<sources.RawSource> {
    const packageConfig = JSON.parse(
      await readFile(path.resolve(__dirname, "package.json"), "utf-8")
    );
    const manifest = JSON.parse(
      await readFile(path.resolve(__dirname, "src/manifest.json"), "utf-8")
    );
    // The version in manifest.json must only be a simple version like 1.2.3,
    // it can't have modifiers like 1.2.3-rc1.
    const match = /^((\d+\.\d+\.\d+).*)$/.exec(packageConfig.version);
    if (!match)
      throw new Error(
        `package.json version is invalid: ${packageConfig.version}`
      );
    const [fullVersion, safeVersion] = match.slice(1);
    if (fullVersion !== safeVersion) {
      manifest.name = `${manifest.name} (${fullVersion})`;
    }
    manifest.version = safeVersion;

    if (options.browser === "firefox") {
      // Firefox needs an ID for Manifest V3 extensions:
      // https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/#when-do-you-need-an-add-on-id
      manifest.browser_specific_settings = {
        gecko: {
          id: "headgear@h4l.users.github.com",
        },
      };
      // Firefox doesn't support service_worker, it uses background scripts
      // ("Event Pages"):
      // https://blog.mozilla.org/addons/2022/10/31/begin-your-mv3-migration-by-implementing-new-features-today/
      manifest.background.scripts = [manifest.background.service_worker];
      delete manifest.background.service_worker;
    }

    return new sources.RawSource(JSON.stringify(manifest, undefined, 2));
  }
}

export function createConfig(options: {
  mode: "development" | "production";
  browser: BrowserTarget;
}): Configuration {
  const config: Configuration = {
    name: options.browser,
    entry: {
      background: "./src/background-entry.ts",
      popup: "./src/popup-entry.tsx",
      reddit: "./src/reddit.ts",
      "text-to-path-service": "./src/text-to-path/service-entry.ts",
    },
    devtool: "source-map",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: [/node_modules/, /\.test\.ts$/],
        },
        // Include source maps from the various Preact dependencies. Preact
        // ships minified code, so if we don't load their source maps we can't
        // really debug their modules.
        {
          use: "source-map-loader",
          enforce: "pre",
          test: /\.js$/,
          include: [/\/node_modules\/.*(?<=\/)@?preact\b/],
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader", "postcss-loader"],
        },
        {
          test: /\.svg$/,
          type: "asset/source",
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "dist", options.browser),
    },

    plugins: [
      new GenerateManifestPlugin({ browser: options.browser }),
      new CopyPlugin({
        patterns: [
          { from: "./src/html/*.html", to: "html/[name].html" },
          { from: "./src/img/*", to: "img/[name][ext]" },
          { from: "./src/font/*", to: "font/[name][ext]" },
        ],
      }),
      // This is a conditional import that we don't trigger, and if it's
      // included it requires polyfills for node modules like fs.
      new IgnorePlugin({
        contextRegExp: /css\/lib\/stringify/,
        resourceRegExp: /source-map-support/,
      }),
    ],
  };

  let overrides: Configuration;
  if (options.mode === "development") {
    overrides = {
      mode: "development",
    };
  } else {
    assert(options.mode === "production");
    overrides = {
      mode: "production",
      optimization: {
        // The Chrome Web Store policies prohibit code obfuscation. They do
        // permit regular minification, so we could leave minimize on. But
        // turning it off only costs ~10KB on the final zip package, and makes
        // it easier to verify the code's behaviour. So I'm going to disable
        // minification for production builds.
        // https://developer.chrome.com/docs/webstore/program_policies/#code-readability
        // https://blog.chromium.org/2018/10/trustworthy-chrome-extensions-by-default.html
        minimize: false,
      },
    };
  }

  return merge(config, overrides);
}
