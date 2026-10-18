import { Font, parse } from "opentype.js";

import { getFont } from "../font-loading";

jest.mock("opentype.js");

describe("getFont", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  beforeEach(() => {
    jest.resetAllMocks();
    fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(new ArrayBuffer(8)));
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("fetches font URL and parses it via opentype.parse", async () => {
    const font = {} as unknown as Font;
    jest.mocked(parse).mockReturnValueOnce(font);
    await expect(getFont("/foo")).resolves.toBe(font);
    expect(fetchSpy).toHaveBeenCalledWith("/foo");
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({ byteLength: 8 })
    );
  });

  test("uses cache for duplicate requests", async () => {
    const font = {} as unknown as Font;
    jest.mocked(parse).mockReturnValueOnce(font);
    await expect(getFont("/bar")).resolves.toBe(font);
    await expect(getFont("/bar")).resolves.toBe(font);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  test("rejects when the font can't be fetched", async () => {
    jest
      .mocked(fetchSpy)
      .mockResolvedValueOnce(
        new Response("", { status: 404, statusText: "Not Found" })
      );
    await expect(getFont("/missing")).rejects.toThrow(
      "Failed to load font /missing: 404 Not Found"
    );
    expect(parse).not.toHaveBeenCalled();
  });
});
