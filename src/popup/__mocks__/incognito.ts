import { signal } from "@preact/signals";

const mod: typeof import("../incognito") =
  jest.createMockFromModule("../incognito");
jest.mocked(mod.getIsIncognitoSignal).mockReturnValue(signal(false));

module.exports = mod;
