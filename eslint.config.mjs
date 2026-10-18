import preact from "eslint-config-preact";
import jest from "eslint-plugin-jest";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist"] },
  preact,
  jest.configs["flat/recommended"],
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      // Keep the behaviour of typescript-eslint v5's recommended config.
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true },
      ],
    },
  }
);
