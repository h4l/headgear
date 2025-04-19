import { mockChrome } from "./chrome.mock";
import "./webapis.mock";

import { ResolvedAvatar, getCurrentAvatar } from "../avatars";
import {
  GetAvatarMessage,
  MSG_GET_AVATAR,
  _avatarVersionTag,
  _generateAvatarVersionTag,
  _getAvatar,
  _handleMessage,
  _sha256,
  registerMessageHandler,
} from "../reddit-interaction";

jest.mock("../avatars", () => ({
  getCurrentAvatar: jest.fn(),
}));

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  jest.mocked(console.warn).mockReset();
  document.body.innerHTML = "";
});

const USER_AVATAR_IMG_HTML_1 = `
<div>
  <div><img alt="User avatar" src="https://styles.redditmedia.com/example/user-avatar-image-123.png?width=256&amp;height=256&amp;crop=256:256,smart&amp;s=xxxxxxxxx"></div>
  <div><img alt="User avatar" src="https://styles.redditmedia.com/example/user-avatar-image-123.png?width=256&amp;height=256&amp;crop=256:256,smart&amp;s=xxxxxxxxx"></div>
<div>`;

const USER_AVATAR_IMG_HTML_2 = `
<div>
  <div><image href="https://styles.redditmedia.com/t5_abcdef/styles/profileIcon_snoof04a451f-e917-40a9-8dec-b55af1ad33c9-headshot.png?width=64&height=64&frame=1&auto=webp&crop=&s=3723351ec61571f2b993861c0137890569ed2c5d" alt="User Avatar" clip-path="url(#f4cb8a2df13ff)" height="100%" width="100%"></image></div>
  <div><image href="https://styles.redditmedia.com/t5_abcdef/styles/profileIcon_snoof04a451f-e917-40a9-8dec-b55af1ad33c9-headshot.png?width=64&height=64&frame=1&auto=webp&crop=&s=3723351ec61571f2b993861c0137890569ed2c5d" alt="User Avatar" clip-path="url(#f4cb8a2df13ff)" height="100%" width="100%"></image></div>
<div>`;

const GET_AVATAR_MESSAGE: Readonly<GetAvatarMessage> = {
  type: MSG_GET_AVATAR,
  apiToken: "__token__",
};

test("_sha256", async () => {
  await expect(_sha256("")).resolves.toEqual(
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  );
  await expect(_sha256("hi")).resolves.toEqual(
    "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"
  );
});

test.each`
  name                   | expected                                                                                 | bodyHtml
  ${"no tag available"}  | ${undefined}                                                                             | ${""}
  ${"tag available old"} | ${"/example/user-avatar-image-123.png"}                                                  | ${USER_AVATAR_IMG_HTML_1}
  ${"tag available new"} | ${"/t5_abcdef/styles/profileIcon_snoof04a451f-e917-40a9-8dec-b55af1ad33c9-headshot.png"} | ${USER_AVATAR_IMG_HTML_2}
`(
  "_avatarVersionTag() with $name",
  async ({
    expected,
    bodyHtml,
  }: {
    expected: string | undefined;
    bodyHtml: string;
  }) => {
    document.body.innerHTML = bodyHtml;
    await expect(_avatarVersionTag("__token__")).resolves.toEqual(
      expected &&
        (await _generateAvatarVersionTag({
          authToken: "__token__",
          avatarUrl: `https://notused.reddit.com${expected}?a=1`,
        }))
    );
  }
);

describe("avatar fetching", () => {
  let avatar: ResolvedAvatar;
  beforeEach(() => {
    avatar = { accessories: [], styles: [] };
    window.chrome = mockChrome();
    jest.mocked(getCurrentAvatar).mockReset().mockResolvedValue(avatar);
  });

  describe("_getAvatar()", () => {
    test("caches requests", async () => {
      document.body.innerHTML = USER_AVATAR_IMG_HTML_2;

      await expect(_getAvatar({ apiToken: "__token__" })).resolves.toBe(avatar);
      expect(getCurrentAvatar).toHaveBeenCalledTimes(1);

      // avatar is now cached, so subsequent calls will not re-fetch
      await expect(_getAvatar({ apiToken: "__token__" })).resolves.toBe(avatar);
      expect(getCurrentAvatar).toHaveBeenCalledTimes(1);
    });

    test("does not cache when no cache key is available", async () => {
      // page with no avatar image to use as a cache key
      document.body.innerHTML = "";

      await expect(_getAvatar({ apiToken: "__token__" })).resolves.toBe(avatar);
      expect(getCurrentAvatar).toHaveBeenCalledTimes(1);

      // avatar is NOT cached, so subsequent calls will re-fetch
      await expect(_getAvatar({ apiToken: "__token__" })).resolves.toBe(avatar);
      expect(getCurrentAvatar).toHaveBeenCalledTimes(2);
    });
  });
  describe("get-avatar message handling", () => {
    test("registerMessageHandler()", () => {
      expect(chrome.runtime.onMessage.addListener).not.toHaveBeenCalled();
      registerMessageHandler();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        _handleMessage
      );
    });
    test("_handleMessage() throws on unexpected message", async () => {
      expect(() =>
        _handleMessage(
          "foo",
          undefined as unknown as chrome.runtime.MessageSender,
          jest.fn()
        )
      ).toThrow("unexpected message: foo");
    });

    // eslint-disable-next-line jest/no-done-callback
    test("_handleMessage() responds with avatar", (done) => {
      const result = _handleMessage(
        GET_AVATAR_MESSAGE,
        undefined as unknown as chrome.runtime.MessageSender,
        ([err, _avatar]) => {
          expect(err).toBeFalsy();
          expect(_avatar).toBe(avatar);
          done();
        }
      );
      expect(result).toBeTruthy();
    });

    // eslint-disable-next-line jest/no-done-callback
    test("_handleMessage() responds with error on failure", (done) => {
      jest.mocked(getCurrentAvatar).mockRejectedValue(new Error("boom!"));
      _handleMessage(
        GET_AVATAR_MESSAGE,
        undefined as unknown as chrome.runtime.MessageSender,
        ([err, _avatar]) => {
          expect(err).not.toBeFalsy();
          expect(err?.message).toBe("boom!");
          expect(_avatar).toBeFalsy();
          done();
        }
      );
    });
  });
});
