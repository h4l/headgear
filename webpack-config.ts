import CopyPlugin from "copy-webpack-plugin";
import * as path from "path";
import { Configuration } from "webpack";

const config: Configuration = {
  entry: {
    reddit: "./src/reddit.ts",
    popup: "./src/popup.tsx",
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
    new CopyPlugin({
      patterns: [
        { from: "./src/manifest.json", to: "." },
        { from: "./src/html/*.html", to: "html/[name].html" },
        { from: "./src/img/*", to: "img/[name][ext]" },
      ],
    }),
  ],
};
export default config;
