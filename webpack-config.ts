import CopyPlugin from "copy-webpack-plugin";
import * as path from "path";
import { BannerPlugin, Configuration } from "webpack";

const config: Configuration = {
  context: path.resolve(__dirname, "./src"),
  entry: {
    main: "./main.ts",
    ["api-token-retriever"]: {
      import: "./api-token-retriever.ts",
      library: {
        type: "var",
        name: "apiTokenRetriever",
      },
    },
  },
  devtool: "cheap-source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
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
    new BannerPlugin({
      // The final statement of api-token-retriever is the "return" value which
      // is exposed from chrome.scripting.executeScript() when it runs
      // api-token-retriever in the context of a Reddit page. I can't see a
      // way to configure Webpack to not wrap the entry module in an IIFE (using
      // iife: false doesn't work), so the BannerPlugin provides a way to tack
      // on the final expression we need.
      banner: "apiTokenRetriever.default();",
      footer: true,
      raw: true,
      include: "api-token-retriever",
    }),
    new CopyPlugin({
      patterns: [{ from: "./manifest.json", to: "." }],
    }),
  ],
};
export default config;
