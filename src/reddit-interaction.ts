import {
  GET_CURRENT_AVATAR_BEHAVIOUR_ID,
  ResolvedAvatar,
  getCurrentAvatar,
} from "./avatars";
import { fetchPageData } from "./page-data";

export const MSG_GET_AVATAR = "get-avatar";
const AVATAR_CACHE_KEY = "cached-current-avatar";

/**
 * Get a string value that changes when the user's avatar is modified.
 */
export async function _avatarVersionTag(): Promise<string | undefined> {
  const [avatarUrl] = Array.from(
    document.querySelectorAll('img[alt="User avatar"]')
  ).map((img) => (img as HTMLImageElement).src);
  if (avatarUrl === undefined) return;
  return await _sha256(
    `${GET_CURRENT_AVATAR_BEHAVIOUR_ID}:${new URL(avatarUrl).pathname}`
  );
}

export async function _sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  const hexDigest = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hexDigest;
}

export async function _fetchUserAPIToken() {
  return (await fetchPageData()).user.session.accessToken;
}

export type GetAvatarMessageResponse =
  | [undefined, ResolvedAvatar]
  | [{ message: string }, undefined];

interface CachedAvatar {
  versionTag: string;
  avatar: ResolvedAvatar;
}

/**
 * Get the user's current avatar.
 *
 * The result is cached in local storage — the Reddit API requests required to
 * assemble the Avatar data are pretty heavy.
 */
export async function _getAvatar(): Promise<ResolvedAvatar> {
  const versionTag = await _avatarVersionTag();
  if (versionTag !== undefined) {
    const cachedAvatar = (await chrome.storage.local.get(AVATAR_CACHE_KEY))[
      AVATAR_CACHE_KEY
    ] as CachedAvatar | undefined;
    if (cachedAvatar !== undefined && cachedAvatar.versionTag === versionTag) {
      console.info(`Using cached avatar data`);
      return cachedAvatar.avatar;
    }
  } else {
    console.warn(
      `Could not create an Avatar version tag, Avatar data will not be cached.`
    );
  }

  const apiToken = await _fetchUserAPIToken();
  const avatar = await getCurrentAvatar({ apiToken });
  if (versionTag !== undefined) {
    const cachedAvatar: CachedAvatar = { versionTag, avatar };
    await chrome.storage.local.set({ [AVATAR_CACHE_KEY]: cachedAvatar });
  }
  return avatar;
}

export function _handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: GetAvatarMessageResponse) => void
): true | undefined {
  if (message !== MSG_GET_AVATAR) {
    throw new Error(`unexpected message: ${message}`);
  }
  _getAvatar()
    .then((avatar) => sendResponse([undefined, avatar]))
    .catch((err) => sendResponse([{ message: err.message }, undefined]));
  // indicate we call sendResponse asynchronously
  return true;
}

export async function registerMessageHandler() {
  chrome.runtime.onMessage.addListener(_handleMessage);
}
