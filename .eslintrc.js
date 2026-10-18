module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "preact",
    "plugin:jest/recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  overrides: [],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {},
};
