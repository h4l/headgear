/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  maxWorkers: 1,
  testPathIgnorePatterns: ["/node_modules/", ".mock."],
};
