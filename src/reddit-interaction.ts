import {
  GET_CURRENT_AVATAR_BEHAVIOUR_ID,
  ResolvedAvatar,
  getCurrentAvatar,
} from "./avatars";

export const MSG_GET_AVATAR = "get-avatar";
export interface GetAvatarMessage {
  type: typeof MSG_GET_AVATAR;
  apiToken: string;
}
const AVATAR_CACHE_KEY = "cached-current-avatar";

export function isGetAvatarMessage(obj: unknown): obj is GetAvatarMessage {
  if (!(typeof obj === "object" && obj)) return false;
  const msg = obj as Partial<GetAvatarMessage>;
  return (
    msg.type === MSG_GET_AVATAR &&
    typeof msg.apiToken === "string" &&
    !!msg.apiToken
  );
}

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

export type GetAvatarMessageResponse =
  | [undefined, ResolvedAvatar | null]
  | [{ message: string }, undefined];

interface CachedAvatar {
  versionTag: string;
  avatar: ResolvedAvatar | null;
}

interface GetAvatarOptions {
  apiToken: string;
}

/**
 * Get the user's current avatar.
 *
 * The result is cached in local storage — the Reddit API requests required to
 * assemble the Avatar data are pretty heavy.
 */
export async function _getAvatar({
  apiToken,
}: GetAvatarOptions): Promise<ResolvedAvatar | null> {
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
  if (!isGetAvatarMessage(message)) {
    throw new Error(`unexpected message: ${message}`);
  }
  _getAvatar({ apiToken: message.apiToken })
    .then((avatar) => sendResponse([undefined, avatar]))
    .catch((err) => sendResponse([{ message: err.message }, undefined]));
  // indicate we call sendResponse asynchronously
  return true;
}

export async function registerMessageHandler() {
  chrome.runtime.onMessage.addListener(_handleMessage);
}
