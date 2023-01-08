import { Font, load } from "opentype.js";

import { getFont } from "../font-loading";

jest.mock("opentype.js");

describe("getFont", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  test("loads font URL via opentype.load", async () => {
    const font = {} as unknown as Font;
    jest.mocked(load).mockResolvedValueOnce(font);
    await expect(getFont("/foo")).resolves.toBe(font);
    expect(load).toBeCalledWith("/foo");
  });

  test("uses cache for duplicate requests", async () => {
    const font = {} as unknown as Font;
    jest.mocked(load).mockResolvedValueOnce(font);
    await expect(getFont("/bar")).resolves.toBe(font);
    await expect(getFont("/bar")).resolves.toBe(font);
    expect(load).toBeCalledWith("/bar");
    expect(load).toBeCalledTimes(1);
  });
});
