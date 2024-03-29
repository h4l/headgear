import { MockOptionsMethodPost } from "fetch-mock";
import fetchMock from "fetch-mock-jest";
import { readFile } from "fs/promises";
import { resolve } from "path";

import { assert } from "../assert";
import {
  AvatarDataResponseData,
  AvatarNFTInfoResponseData,
  _GQL_QUERY_ID_AVATAR_DATA,
  _GQL_QUERY_ID_NFT_INFO,
  _fetchAvatarData,
  _fetchAvatarNFTData,
  _validateSVGStyle,
  getCurrentAvatar,
} from "../avatars";

const AVATAR_DATA_REQUEST: MockOptionsMethodPost = {
  name: "avatar-data",
  url: "https://gql.reddit.com/",
  matchPartialBody: true,
  body: { id: _GQL_QUERY_ID_AVATAR_DATA },
};
const NFT_INFO_REQUEST: MockOptionsMethodPost = {
  name: "nft-info",
  url: "https://gql.reddit.com/",
  matchPartialBody: true,
  body: { id: _GQL_QUERY_ID_NFT_INFO },
};

beforeEach(() => {
  fetchMock.restore();
});

beforeAll(() => {
  const _origReadAsDataURL = FileReader.prototype.readAsDataURL;
  jest
    .spyOn(FileReader.prototype, "readAsDataURL")
    .mockImplementation(function (this: FileReader, blob: Blob) {
      // fetch-mock and jsdom don't use the same Blob implementation, and jsdom
      // only accepts its own Blob objects. We only use mock ascii text data, so
      // we can just mediate between them with strings...
      // See https://github.com/jsdom/jsdom/issues/2555
      blob
        .text()
        .then((text) => {
          _origReadAsDataURL.call(this, new Blob([text], { type: blob.type }));
        })
        .catch((err) => {
          console.error(
            `Failed to read Blob.text() while wrapping FileReader.readAsDataURL()`,
            err
          );
        });
    });
});
afterAll(() => {
  jest.mocked(FileReader.prototype.readAsDataURL).mockReset();
});

async function exampleAvatarDataResponseJSON(): Promise<AvatarDataResponseData> {
  return JSON.parse(
    await readFile(resolve(__dirname, "avatar-data-response.json"), {
      encoding: "utf-8",
    })
  ) as AvatarDataResponseData;
}

async function exampleNonNftAvatarDataResponseJSON(): Promise<AvatarDataResponseData> {
  return JSON.parse(
    await readFile(resolve(__dirname, "non-nft-avatar-data-response.json"), {
      encoding: "utf-8",
    })
  ) as AvatarDataResponseData;
}

async function exampleAvatarNFTInfoResponseDataJSON(): Promise<AvatarNFTInfoResponseData> {
  return JSON.parse(
    await readFile(resolve(__dirname, "nft-info-response.json"), {
      encoding: "utf-8",
    })
  ) as AvatarNFTInfoResponseData;
}

describe("_fetchAvatarData()", () => {
  test("throws on failed API call", async () => {
    fetchMock.post(AVATAR_DATA_REQUEST, {
      status: 500,
      body: "Server is on fire.",
    });
    await expect(_fetchAvatarData({ apiToken: "123" })).rejects.toThrow(
      `Avatar Data API request failed: 500 Internal Server Error: Server is on fire.`
    );
  });

  test("throws on unexpected API response data", async () => {
    fetchMock.post(AVATAR_DATA_REQUEST, { body: {} });
    await expect(_fetchAvatarData({ apiToken: "123" })).rejects.toThrow(
      `Avatar Data API response JSON is not structured as expected`
    );
  });

  test("returns API response data", async () => {
    fetchMock.post(AVATAR_DATA_REQUEST, {
      body: await exampleAvatarDataResponseJSON(),
    });
    await expect(_fetchAvatarData({ apiToken: "123" })).resolves.toEqual(
      (
        await exampleAvatarDataResponseJSON()
      ).data
    );
    expect(fetchMock).toHaveFetched("https://gql.reddit.com/", {
      headers: { authorization: "Bearer 123" },
      body: { id: _GQL_QUERY_ID_AVATAR_DATA },
      matchPartialBody: true,
    });
  });
});

describe("_fetchAvatarNFTData()", () => {
  test("throws on failed API call", async () => {
    fetchMock.post(NFT_INFO_REQUEST, {
      status: 500,
      body: "Server is on fire.",
    });
    await expect(
      _fetchAvatarNFTData({
        apiToken: "123",
        nftId: "nft_eip155:137_425bf054ef7bad65b7bdd8e6587b1c3500e4f4ca_477",
      })
    ).rejects.toThrow(
      `Avatar Data API request failed: 500 Internal Server Error: Server is on fire.`
    );
  });

  test("throws on unexpected API response data", async () => {
    fetchMock.post(NFT_INFO_REQUEST, { body: {} });
    await expect(
      _fetchAvatarNFTData({
        apiToken: "123",
        nftId: "nft_eip155:137_425bf054ef7bad65b7bdd8e6587b1c3500e4f4ca_477",
      })
    ).rejects.toThrow(
      `Avatar NFT Info API response JSON is not structured as expected`
    );
  });

  test("returns API response data", async () => {
    fetchMock.post(NFT_INFO_REQUEST, {
      body: await exampleAvatarNFTInfoResponseDataJSON(),
    });
    await expect(
      _fetchAvatarNFTData({
        apiToken: "123",
        nftId: "nft_eip155:137_425bf054ef7bad65b7bdd8e6587b1c3500e4f4ca_477",
      })
    ).resolves.toEqual(
      (
        await exampleAvatarNFTInfoResponseDataJSON()
      ).data.inventoryItems.edges[0].node
    );
    expect(fetchMock).toHaveFetched("https://gql.reddit.com/", {
      headers: { authorization: "Bearer 123" },
      body: {
        id: "e9865cc4d93d",
        variables: {
          ids: ["nft_eip155:137_425bf054ef7bad65b7bdd8e6587b1c3500e4f4ca_477"],
        },
      },
      matchPartialBody: true,
    });
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
  fetchMock.post(AVATAR_DATA_REQUEST, {
    body: await exampleNonNftAvatarDataResponseJSON(),
  });
  fetchMock.get("glob:https://i.redd.it/snoovatar/*", () => {
    return {
      headers: { "content-type": "image/png" },
      body: Buffer.alloc(8, "fakedata"),
    };
  });

  await expect(getCurrentAvatar({ apiToken: "foo" })).rejects.toThrow(
    "Response is not an image in SVG format"
  );
});

test("getCurrentAvatar() returns avatar with NFT info for NFT avatar", async () => {
  fetchMock.post(AVATAR_DATA_REQUEST, {
    body: await exampleAvatarDataResponseJSON(),
  });
  fetchMock.post(NFT_INFO_REQUEST, {
    body: await exampleAvatarNFTInfoResponseDataJSON(),
  });
  fetchMock.get("glob:https://i.redd.it/snoovatar/*.svg", (url) => {
    return {
      headers: { "content-type": "image/svg+xml" },
      body: `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${url} --></svg>`,
    };
  });
  fetchMock.get("glob:https://i.redd.it/snoovatar/*", () => {
    return {
      headers: { "content-type": "image/png" },
      body: "fakedata",
    };
  });

  const avatarData = await exampleAvatarDataResponseJSON();
  const avatar = avatarData.data.avatarBuilderCatalog.avatar;
  const resolvedAvatar = await getCurrentAvatar({ apiToken: "foo" });
  assert(avatar && resolvedAvatar);

  expect(resolvedAvatar.styles).toEqual(avatar.styles);
  expect([...new Set(resolvedAvatar.accessories.map((acc) => acc.id))]).toEqual(
    [...new Set(avatar.accessoryIds)]
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
  ).toBe(resolvedAvatar.accessories.length);

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

  // The hair accessory has two asset layers
  expect(
    resolvedAvatar.accessories.filter((acc) => acc.id === "outfits_1_hair_006")
      .length
  ).toBe(2);

  // This is an NFT avatar
  const nftInfo = resolvedAvatar.nftInfo;
  assert(nftInfo);
  expect(nftInfo.nftId).toEqual(
    "nft_eip155:137_425bf054ef7bad65b7bdd8e6587b1c3500e4f4ca_477"
  );
  expect(nftInfo.backgroundImage.httpUrl).toBe(
    "https://i.redd.it/snoovatar/snoo_assets/UI4W3ys3XdI_BGC_les_rock_001.png"
  );
  expect(nftInfo.backgroundImage.dataUrl).toEqual(
    "data:image/png;base64,ZmFrZWRhdGE="
  );
  expect(nftInfo.name).toEqual("Les Rock #478");
  expect(nftInfo.seriesSize).toEqual(1000);
});

test("getCurrentAvatar() omits NFT info for regular avatars", async () => {
  fetchMock.post(AVATAR_DATA_REQUEST, {
    body: await exampleNonNftAvatarDataResponseJSON(),
  });
  fetchMock.get("glob:https://i.redd.it/snoovatar/*.svg", (url) => {
    return {
      headers: { "content-type": "image/svg+xml" },
      body: `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${url} --></svg>`,
    };
  });

  const avatarData = await exampleNonNftAvatarDataResponseJSON();
  const avatar = avatarData.data.avatarBuilderCatalog.avatar;
  const resolvedAvatar = await getCurrentAvatar({ apiToken: "foo" });
  assert(avatar && resolvedAvatar);

  expect(resolvedAvatar.styles).toEqual(avatar.styles);
  expect([...new Set(resolvedAvatar.accessories.map((acc) => acc.id))]).toEqual(
    [...new Set(avatar.accessoryIds)]
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
  ).toBe(resolvedAvatar.accessories.length);

  expect(
    resolvedAvatar.accessories.find(
      (acc) => acc.id === "premium_cricket_helmet"
    )
  ).toEqual({
    customizableClasses: ["hat"],
    id: "premium_cricket_helmet",
    slotNumber: 80,
    svgData: `<svg xmlns="http://www.w3.org/2000/svg"><!-- https://i.redd.it/snoovatar/accessory_assets/_9an0Q3Akvo_cricket_helmet.svg --></svg>`,
  });
  // The hair accessory has two asset layers
  expect(
    resolvedAvatar.accessories.filter((acc) => acc.id === "outfits_1_hair_006")
      .length
  ).toBe(2);

  expect(resolvedAvatar.nftInfo).toBeFalsy();
});

test("getCurrentAvatar() resolves to none when users have no avatar", async () => {
  const body = await exampleNonNftAvatarDataResponseJSON();
  body.data.avatarBuilderCatalog.avatar = null;
  fetchMock.post(AVATAR_DATA_REQUEST, { body });
  await expect(getCurrentAvatar({ apiToken: "foo" })).resolves.toBeNull();
});
