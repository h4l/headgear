import { waitFor } from "@testing-library/preact";

import { mockChrome } from "../../__tests__/chrome.mock";

import { getIsIncognitoSignal } from "../incognito";

beforeEach(() => {
  window.chrome = mockChrome();
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).chrome;
});

describe("isIncognitoSignal()", () => {
  test.each`
    isIncognito
    ${true}
    ${false}
  `(
    "reflects current window's incognito $isIncognito value",
    async ({ isIncognito }: { isIncognito: boolean }) => {
      jest.spyOn(chrome.windows, "getCurrent").mockResolvedValueOnce({
        incognito: isIncognito,
      } as chrome.windows.Window);

      const signal = getIsIncognitoSignal();

      await waitFor(() => {
        expect(signal.value).not.toBeUndefined();
        expect(signal.value).toBe(isIncognito);
      });
    }
  );
});
