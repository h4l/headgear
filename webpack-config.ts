import * as path from "path";
import { Configuration } from "webpack";
import CopyPlugin from 'copy-webpack-plugin';

const config: Configuration = {
    context: path.resolve(__dirname, './src'),
    entry: "./index.ts",
    devtool: 'cheap-source-map',
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
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
    plugins: [
        new CopyPlugin({
            patterns: [{ from: "./manifest.json", to: ".", }]
        }),
    ],
};
export default config;
