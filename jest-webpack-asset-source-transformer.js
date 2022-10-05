/**
 * A Jest SyncTransformer that mimics a webpack asset/source module.
 *
 * i.e. it allows importing a file by transforming the file into a CommonJS
 * module that exports the file's contents as a string.
 */
const WebpackAssetSourceTransformer = {
  process(sourceText) {
    return {
      code: `module.exports = ${JSON.stringify(sourceText)};`,
    };
  },
};

module.exports = WebpackAssetSourceTransformer;
