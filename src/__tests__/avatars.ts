import { readFile } from "fs/promises";
import { resolve } from "path";

import { fetchAvatarData } from "../avatars";

global.fetch = jest.fn();
const mockFetch = jest.mocked(global.fetch);
beforeEach(() => {
  mockFetch.mockClear();
});

async function exampleAvatarDataResponseJSON() {
  return JSON.parse(
    await readFile(resolve(__dirname, "avatar-data-response.json"), {
      encoding: "utf-8",
    })
  );
}

test("fetchAvatarData() throws on failed API call", async () => {
  const mockResp: Partial<Response> = {
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
    async text() {
      return "Server is on fire.";
    },
  };
  mockFetch.mockResolvedValue(mockResp as Response);
  await expect(fetchAvatarData("apitoken123")).rejects.toThrow(
    `Avatar Data API request failed: 500 Internal Server Error: Server is on fire.`
  );
});

test("fetchAvatarData() throws on unexpected API response data", async () => {
  const mockResp: Partial<Response> = {
    ok: true,
    async json() {
      return {};
    },
  };
  mockFetch.mockResolvedValue(mockResp as Response);
  await expect(fetchAvatarData("apitoken123")).rejects.toThrow(
    `Avatar Data API response JSON is not structured as expected`
  );
});

test("fetchAvatarData() returns API response data", async () => {
  const mockResp: Partial<Response> = {
    ok: true,
    async json() {
      return await exampleAvatarDataResponseJSON();
    },
  };
  mockFetch.mockResolvedValue(mockResp as Response);
  await expect(fetchAvatarData("apitoken123")).resolves.toEqual(
    (
      await exampleAvatarDataResponseJSON()
    ).data
  );
});
