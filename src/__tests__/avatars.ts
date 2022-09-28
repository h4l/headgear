import fetchMock from "fetch-mock-jest";
import { readFile } from "fs/promises";
import { resolve } from "path";

import {
  AvatarDataResponseData,
  _fetchAvatarData,
  _validateSVGStyle,
  getCurrentAvatar,
} from "../avatars";

afterEach(() => {
  fetchMock.restore();
});

async function exampleAvatarDataResponseJSON(): Promise<AvatarDataResponseData> {
  return JSON.parse(
    await readFile(resolve(__dirname, "avatar-data-response.json"), {
      encoding: "utf-8",
    })
  ) as AvatarDataResponseData;
}

test("_fetchAvatarData() throws on failed API call", async () => {
  fetchMock.post("https://gql.reddit.com/", {
    status: 500,
    body: "Server is on fire.",
  });
  await expect(_fetchAvatarData({ apiToken: "123" })).rejects.toThrow(
    `Avatar Data API request failed: 500 Internal Server Error: Server is on fire.`
  );
});

test("_fetchAvatarData() throws on unexpected API response data", async () => {
  fetchMock.post("https://gql.reddit.com/", { body: {} });
  await expect(_fetchAvatarData({ apiToken: "123" })).rejects.toThrow(
    `Avatar Data API response JSON is not structured as expected`
  );
});

test("_fetchAvatarData() returns API response data", async () => {
  fetchMock.post("https://gql.reddit.com/", {
    body: await exampleAvatarDataResponseJSON(),
  });
  await expect(_fetchAvatarData({ apiToken: "123" })).resolves.toEqual(
    (
      await exampleAvatarDataResponseJSON()
    ).data
  );
  expect(fetchMock).toHaveFetched("https://gql.reddit.com/", {
    headers: { authorization: "Bearer 123" },
    body: { id: "d78e4dc3c12e" },
    matchPartialBody: true,
  });
});

test.each([[{}], [{ className: "foo", fill: "#fff", unsupported: "foo" }]])(
  "_validateSVGStyle() rejects objects with unexpected properties",
  (styleObj) => {
    expect(() => _validateSVGStyle(styleObj)).toThrow(
      "Style does not have expected properties: "
    );
  }
);

test("getCurrentAvatar() throws on non SVG asset image", async () => {
  fetchMock.post("https://gql.reddit.com/", {
    body: await exampleAvatarDataResponseJSON(),
  });
  fetchMock.get("glob:https://i.redd.it/snoovatar/*", (url) => {
    return {
      headers: { ["content-type"]: "image/png" },
      body: Buffer.alloc(0),
    };
  });

  await expect(getCurrentAvatar({ apiToken: "foo" })).rejects.toThrow(
    "Response is not an image in SVG format"
  );
});

test("getCurrentAvatar()", async () => {
  fetchMock.post("https://gql.reddit.com/", {
    body: await exampleAvatarDataResponseJSON(),
  });
  fetchMock.get("glob:https://i.redd.it/snoovatar/*.svg", (url) => {
    return {
      headers: { ["content-type"]: "image/svg+xml" },
      body: `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${url} --></svg>`,
    };
  });

  const avatarData = await exampleAvatarDataResponseJSON();
  const avatar = avatarData.data.avatarBuilderCatalog.avatar;
  const resolvedAvatar = await getCurrentAvatar({ apiToken: "foo" });

  expect(resolvedAvatar.styles).toEqual(avatar.styles);
  expect(resolvedAvatar.accessories.map((acc) => acc.id)).toEqual(
    avatar.accessoryIds
  );
  expect(
    resolvedAvatar.accessories.every(
      (acc) => typeof acc.slotNumber === "number"
    )
  ).toBeTruthy();
  expect(
    resolvedAvatar.accessories.every((acc) => /<svg\b/.test(acc.svgData))
  ).toBeTruthy();
  expect(
    new Set(resolvedAvatar.accessories.map((acc) => acc.svgData)).size
  ).toBe(8);

  expect(
    resolvedAvatar.accessories.find(
      (acc) => acc.id === "gaming_body_bottom_006"
    )
  ).toEqual({
    customizableClasses: ["jumpsuit", "shoes", "body"],
    id: "gaming_body_bottom_006",
    slotNumber: 30,
    svgData: `<svg xmlns="http://www.w3.org/2000/svg"><!-- https://i.redd.it/snoovatar/accessory_assets/vO5m6xr_4KQ_gaming_body_bottom_006.svg --></svg>`,
  });
});
