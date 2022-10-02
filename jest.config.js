/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    // jsdom test environment uses "browser" by default. This causes jest to
    // import the "browser" export from package.json. Preact (and probably other
    // modules) link to ESM modules from the "browser" export, and this fails
    // because jest doesn't support ESM modules by default (and doesn't
    // transpile stuff in node_modules by default).
    // See: https://jestjs.io/docs/configuration#testenvironmentoptions-object
    customExportConditions: ["node", "node-addons"],
  },
  maxWorkers: 1,
  testPathIgnorePatterns: ["/node_modules/", ".mock."],
};
