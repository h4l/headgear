import { webcrypto } from "node:crypto";
import { TextEncoder } from "util";

Object.defineProperty(window, "crypto", {
  writable: false,
  value: webcrypto,
});

Object.defineProperty(window, "TextEncoder", {
  writable: true,
  value: TextEncoder,
});
