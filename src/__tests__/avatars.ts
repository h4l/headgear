import fetchMock from "@fetch-mock/jest";
import { readFile } from "fs/promises";
import { resolve } from "path";

import { assert } from "../assert";
import {
  _AVATAR_EDIT_URL,
  _NFT_CARD_URL_PREFIX,
  _fetchAvatarState,
  _fetchNftCardData,
  _validateSVGStyle,
  getCurrentAvatar,
} from "../avatars";

const PARTIAL_HTML_HEADERS = {
  "content-type": "text/vnd.reddit.partial+html; charset=utf-8",
};
const NFT_ID = "nft_eip155:137_9d8542ef1237933badbe867291f6c0434b8d315c_2713";

beforeEach(() => {
  fetchMock.mockReset();
});

beforeAll(() => {
  fetchMock.mockGlobal();
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
  fetchMock.mockRestore();
  jest.mocked(FileReader.prototype.readAsDataURL).mockReset();
});

async function readFixture(name: string): Promise<string> {
  return await readFile(resolve(__dirname, name), { encoding: "utf-8" });
}

type AvatarEditFixture = "nft" | "non-nft" | "no-avatar";
async function mockAvatarEditResponse(
  fixture: AvatarEditFixture
): Promise<void> {
  fetchMock.get(_AVATAR_EDIT_URL, {
    headers: PARTIAL_HTML_HEADERS,
    body: await readFixture(`avatar-edit-response-${fixture}.html`),
  });
}

type NftCardFixture = "limited" | "unlimited";
async function mockNftCardResponse(fixture: NftCardFixture): Promise<void> {
  fetchMock.get(`begin:${_NFT_CARD_URL_PREFIX}`, {
    headers: PARTIAL_HTML_HEADERS,
    body: await readFixture(
      `product-detail-card-view-data-fetcher-item-response-drop-size-${fixture}.html`
    ),
  });
}

function mockAvatarStateResponse(initialState: string): void {
  const attr = initialState.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  fetchMock.get(_AVATAR_EDIT_URL, {
    headers: PARTIAL_HTML_HEADERS,
    body: `<avatar-state-container initial-state="${attr}"></avatar-state-container>`,
  });
}

function mockImageResponses(): void {
  fetchMock.get("glob:https://i.redd.it/snoovatar/*.svg", ({ url }) => {
    return {
      headers: { "content-type": "image/svg+xml" },
      body: `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${url} --></svg>`,
    };
  });
  fetchMock.get("glob:https://i.redd.it/snoovatar/*.png", () => {
    return {
      headers: { "content-type": "image/png" },
      body: "fakedata",
    };
  });
}

describe("_fetchAvatarState()", () => {
  test("throws on failed request", async () => {
    fetchMock.get(_AVATAR_EDIT_URL, {
      status: 500,
      body: "Server is on fire.",
    });
    await expect(_fetchAvatarState()).rejects.toThrow(
      `Request for ${_AVATAR_EDIT_URL} failed: 500 Internal Server Error: Server is on fire.`
    );
  });

  test("throws when page has no avatar-state-container", async () => {
    // e.g. when logged out
    fetchMock.get(_AVATAR_EDIT_URL, {
      headers: PARTIAL_HTML_HEADERS,
      body: "<div>Log in</div>",
    });
    await expect(_fetchAvatarState()).rejects.toThrow(
      "Avatar edit page is not structured as expected: no avatar-state-container initial-state"
    );
  });

  test("throws when initial-state is not JSON", async () => {
    mockAvatarStateResponse("{nope");
    await expect(_fetchAvatarState()).rejects.toThrow(
      "Avatar edit page is not structured as expected: avatar-state-container initial-state is not valid JSON"
    );
  });

  test.each([
    [{}],
    [
      {
        accessoriesBySlot: {},
        backgroundImage: { id: "nft_foo" },
        customColorsByClassName: {},
      },
    ],
    [
      {
        accessoriesBySlot: { HAIR: { id: "hair" } },
        backgroundImage: null,
        customColorsByClassName: {},
      },
    ],
    [
      {
        accessoriesBySlot: {},
        backgroundImage: null,
        customColorsByClassName: {
          body: { className: "body", fill: "#fff", unsupported: "foo" },
        },
      },
    ],
  ])("throws on unexpected initial-state JSON: %j", async (state) => {
    mockAvatarStateResponse(JSON.stringify(state));
    await expect(_fetchAvatarState()).rejects.toThrow(
      "Avatar state JSON is not structured as expected"
    );
  });

  test("returns avatar state", async () => {
    await mockAvatarEditResponse("nft");
    const state = await _fetchAvatarState();

    expect(state.backgroundImage).toEqual({
      id: NFT_ID,
      url: "https://i.redd.it/snoovatar/snoo_assets/submissions/temp/ziREML_VnuE_.png",
    });
    expect(Object.keys(state.accessoriesBySlot).sort()).toEqual([
      "BACKGROUND",
      "BODY",
      "BODY_BOTTOM",
      "FACE_LOWER",
      "FACE_UPPER",
      "HEAD_ACCESSORY",
    ]);
    expect(Object.keys(state.customColorsByClassName).sort()).toEqual([
      "body",
      "eyes",
      "facialhair",
      "hair",
    ]);
    expect(fetchMock).toHaveFetched(_AVATAR_EDIT_URL, {
      headers: { accept: "text/vnd.reddit.partial+html, text/html;q=0.9" },
    });
  });
});

describe("_fetchNftCardData()", () => {
  test("throws on failed request", async () => {
    fetchMock.get(`begin:${_NFT_CARD_URL_PREFIX}`, {
      status: 500,
      body: "Server is on fire.",
    });
    await expect(_fetchNftCardData(NFT_ID)).rejects.toThrow(
      "failed: 500 Internal Server Error: Server is on fire."
    );
  });

  test("throws when response has no product-detail-card-view", async () => {
    fetchMock.get(`begin:${_NFT_CARD_URL_PREFIX}`, {
      headers: PARTIAL_HTML_HEADERS,
      body: "<div></div>",
    });
    await expect(_fetchNftCardData(NFT_ID)).rejects.toThrow(
      "NFT details are not structured as expected: no product-detail-card-view nft-title"
    );
  });

  test.each([
    ["missing", ""],
    ["empty", ` drop-size=""`],
    ["negative", ` drop-size="-1"`],
    ["fractional", ` drop-size="1.5"`],
    ["non-numeric", ` drop-size="1k"`],
  ])("throws when drop-size is %s", async (_, dropSizeAttr) => {
    fetchMock.get(`begin:${_NFT_CARD_URL_PREFIX}`, {
      headers: PARTIAL_HTML_HEADERS,
      body: `<product-detail-card-view nft-title="Foo #1"${dropSizeAttr}></product-detail-card-view>`,
    });
    await expect(_fetchNftCardData(NFT_ID)).rejects.toThrow(
      "NFT details are not structured as expected: product-detail-card-view drop-size is not a non-negative integer"
    );
  });

  test("returns data for limited-size NFT", async () => {
    await mockNftCardResponse("limited");
    await expect(_fetchNftCardData(NFT_ID)).resolves.toEqual({
      name: "Confrontation #114",
      seriesSize: 1000,
    });
    expect(fetchMock).toHaveFetched(`${_NFT_CARD_URL_PREFIX}${NFT_ID}`);
  });

  test("returns null seriesSize for unlimited-size NFT", async () => {
    await mockNftCardResponse("unlimited");
    await expect(_fetchNftCardData(NFT_ID)).resolves.toEqual({
      name: "Coin Collectors #16089",
      seriesSize: null,
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
  await mockAvatarEditResponse("non-nft");
  fetchMock.get("glob:https://i.redd.it/snoovatar/*", () => {
    return {
      headers: { "content-type": "image/png" },
      body: Buffer.alloc(8, "fakedata"),
    };
  });

  await expect(getCurrentAvatar()).rejects.toThrow(
    "Response is not an image in SVG format"
  );
});

test("getCurrentAvatar() returns avatar with NFT info for NFT avatar", async () => {
  await mockAvatarEditResponse("nft");
  await mockNftCardResponse("limited");
  mockImageResponses();

  const resolvedAvatar = await getCurrentAvatar();
  assert(resolvedAvatar);

  expect(resolvedAvatar.styles).toEqual([
    { className: "body", fill: "#000000" },
    { className: "eyes", fill: "#F0F0F0" },
    { className: "facialhair", fill: "#000000" },
    { className: "hair", fill: "#000000" },
  ]);
  expect(
    resolvedAvatar.accessories.map((acc) => [acc.id, acc.slotNumber]).sort()
  ).toEqual(
    [
      ["basic_background_001", 0],
      ["t2_d7lr6_face_lower_Hgh0ORZxMJQ", 50],
      ["t2_k8ezrq7t_head_accessory_Wu_GZ-z43jU", 80],
      ["t2_kismpatm_body_bottom_I77vXq9YiOo", 30],
      ["t2_kismpatm_body_tsyjIwl5E3M", 40],
      ["t2_shywnhcgb_face_upper_tbGOBEp3Cto", 60],
    ].sort()
  );
  expect(
    resolvedAvatar.accessories.find(
      (acc) => acc.id === "t2_d7lr6_face_lower_Hgh0ORZxMJQ"
    )
  ).toEqual({
    customizableClasses: ["body"],
    id: "t2_d7lr6_face_lower_Hgh0ORZxMJQ",
    slotNumber: 50,
    svgData: `<svg xmlns="http://www.w3.org/2000/svg"><!-- https://i.redd.it/snoovatar/snoo_assets/submissions/Hgh0ORZxMJQ_.svg --></svg>`,
  });

  // This is an NFT avatar
  expect(resolvedAvatar.nftInfo).toEqual({
    nftId: NFT_ID,
    name: "Confrontation #114",
    seriesSize: 1000,
    backgroundImage: {
      httpUrl:
        "https://i.redd.it/snoovatar/snoo_assets/submissions/temp/ziREML_VnuE_.png",
      dataUrl: "data:image/png;base64,ZmFrZWRhdGE=",
    },
  });
  expect(fetchMock).toHaveFetched(`${_NFT_CARD_URL_PREFIX}${NFT_ID}`);
});

test("getCurrentAvatar() omits NFT info for regular avatars", async () => {
  await mockAvatarEditResponse("non-nft");
  mockImageResponses();

  const resolvedAvatar = await getCurrentAvatar();
  assert(resolvedAvatar);

  expect(resolvedAvatar.styles).toEqual([
    { className: "body", fill: "#FFFFFF" },
    { className: "eyes", fill: "#FF4500" },
    { className: "facialhair", fill: "#C08D41" },
    { className: "hair", fill: "#C08D41" },
  ]);
  expect(resolvedAvatar.accessories.length).toBe(9);
  expect(
    resolvedAvatar.accessories.every((acc) => /<svg\b/.test(acc.svgData))
  ).toBeTruthy();
  expect(
    new Set(resolvedAvatar.accessories.map((acc) => acc.svgData)).size
  ).toBe(resolvedAvatar.accessories.length);

  // The hair accessory has two asset layers, occupying two slots
  expect(
    resolvedAvatar.accessories
      .filter(
        (acc) => acc.id === "ParamountPics_StreetFighterhair_007_VERSION_2"
      )
      .map((acc) => acc.slotNumber)
      .sort((a, b) => a - b)
  ).toEqual([20, 70]);

  expect(resolvedAvatar.nftInfo).toBeFalsy();
  expect(fetchMock).not.toHaveFetched(`begin:${_NFT_CARD_URL_PREFIX}`);
});

test("getCurrentAvatar() resolves to null when users have no avatar", async () => {
  await mockAvatarEditResponse("no-avatar");
  await expect(getCurrentAvatar()).resolves.toBeNull();
  expect(fetchMock.callHistory.calls().length).toBe(1);
});
