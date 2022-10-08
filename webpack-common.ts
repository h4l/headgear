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

/** Generate manifest.json */
class GenerateManifestPlugin {
  apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap("GenerateManifestPlugin", (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: "GenerateManifestPlugin",
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        async (assets) => {
          assets["manifest.json"] = await this.generateManifest();
        }
      );
    });
  }
  async generateManifest(): Promise<sources.RawSource> {
    const packageConfig = JSON.parse(
      await readFile(path.resolve(__dirname, "package.json"), "utf-8")
    );
    const manifest = JSON.parse(
      await readFile(path.resolve(__dirname, "src/manifest.json"), "utf-8")
    );
    manifest.version = packageConfig.version;
    return new sources.RawSource(JSON.stringify(manifest, undefined, 2));
  }
}

const config: Configuration = {
  entry: {
    background: "./src/background-entry.ts",
    popup: "./src/popup-entry.tsx",
    reddit: "./src/reddit.ts",
  },
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: [/node_modules/, /\.test\.ts$/],
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
    path: path.resolve(__dirname, "dist"),
  },

  plugins: [
    new GenerateManifestPlugin(),
    new CopyPlugin({
      patterns: [
        { from: "./src/html/*.html", to: "html/[name].html" },
        { from: "./src/img/*", to: "img/[name][ext]" },
      ],
    }),
    // This is a conditional import that we don't trigger, and if it's included
    // it requires polyfills for node modules like fs.
    new IgnorePlugin({
      contextRegExp: /css\/lib\/stringify/,
      resourceRegExp: /source-map-support/,
    }),
  ],
};
export default config;
