/**
 * The user's current avatar, as described by the Avatar Builder page's
 * `<avatar-state-container initial-state="...">` attribute.
 */
export interface AvatarState {
  /** Keyed by slot name, e.g. "HAIR", "HAIR_BACK", "BACKGROUND". */
  accessoriesBySlot: Record<string, SlotAccessory>;
  /** An NFT background, or null for regular avatars. */
  backgroundImage: null | {
    /** The NFT id, e.g. `nft_eip155:${CHAIN_ID}_${CONTRACT_ID}_${TOKEN_ID}` */
    id: string;
    url: string;
  };
  customColorsByClassName: Record<string, SVGStyle>;
}

/**
 * An accessory occupying a slot. Accessories with multiple layers (e.g. hair
 * with a front and back layer) are represented by multiple instances of
 * `SlotAccessory`, each with the same `id` but different `asset`.
 */
interface SlotAccessory {
  id: string;
  customizableClasses: string[];
  asset: SlotAsset;
}

interface SlotAsset {
  imageUrl: string;
  slotNumber: number;
}

export interface SVGStyle {
  className: string;
  fill: string;
}

export interface NftCardData {
  name: string;
  seriesSize: number | null;
}

function _isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function _validateSlotAccessory(
  value: unknown
): asserts value is SlotAccessory {
  if (!(
    _isObject(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.customizableClasses) &&
    value.customizableClasses.every((cls) => typeof cls === "string") &&
    _isObject(value.asset) &&
    typeof value.asset.imageUrl === "string" &&
    typeof value.asset.slotNumber === "number"
  )) {
    throw new Error(
      `Slot accessory is not structured as expected: ${JSON.stringify(value)}`
    );
  }
}

function validateAvatarState(json: unknown): asserts json is AvatarState {
  const msg = "Avatar state JSON is not structured as expected";
  const state = json as Partial<Record<keyof AvatarState, unknown>>;
  const bg = state?.backgroundImage;
  if (!(
    _isObject(state) &&
    _isObject(state.accessoriesBySlot) &&
    _isObject(state.customColorsByClassName) &&
    (bg === null ||
      (_isObject(bg) &&
        typeof bg.id === "string" &&
        typeof bg.url === "string"))
  )) {
    throw new Error(msg);
  }

  try {
    Object.values(state.accessoriesBySlot).forEach((acc) =>
      _validateSlotAccessory(acc)
    );
    // We need to be strict about the contents of the style objects, as if they
    // contain unexpected properties our merged SVGs will not render as
    // intended.
    Object.values(state.customColorsByClassName).forEach((style) =>
      _validateSVGStyle(style as object)
    );
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    throw new Error(`${msg}. ${e.message}`);
  }
}

async function _failedResponseSummary(resp: Response): Promise<string> {
  return `${resp.status} ${resp.statusText}: ${await resp.text()}`;
}

/**
 * Avatar data comes from internal endpoints of Reddit's web UI, which respond
 * with HTML that we parse to read the data out of element attributes. Reddit
 * doesn't provide access to Avatar info through its public API.
 *
 * This is fundamentally the reason why Headgear is a browser extension instead
 * of a stand-alone web app. These requests are made from the content script
 * running in the user's reddit.com tab, so they're same-origin requests that
 * carry the user's session cookies, giving Headgear the same view of Reddit
 * the logged-in user has.
 *
 * Being internal, these endpoints and the HTML structure they respond with
 * could be changed or removed at any time.
 *
 * The endpoints can be found by using a browser's dev tools to observe HTTP
 * requests made when opening the Avatar Builder.
 */
export const _AVATAR_EDIT_URL =
  "https://www.reddit.com/avatar/edit?tab=Outfits";
export const _NFT_CARD_URL_PREFIX =
  "https://www.reddit.com/svc/shreddit/product-detail-card-view-data-fetcher/item/";

/**
 * Fetch a Reddit web page, preferring Reddit's partial HTML format, which
 * omits the page's outer structure.
 *
 * The returned Document is inert: it has no browsing context, so its scripts
 * don't run, event handler attributes don't fire, and no subresources load. It
 * must only be read from — its nodes must never be inserted into or adopted by
 * the live page's document, as they would no longer be inert.
 */
async function _fetchPartialHtml(url: string): Promise<Document> {
  const resp = await fetch(url, {
    headers: { accept: "text/vnd.reddit.partial+html, text/html;q=0.9" },
  });
  if (!resp.ok) {
    throw new Error(
      `Request for ${url} failed: ${await _failedResponseSummary(resp)}`
    );
  }
  return new DOMParser().parseFromString(await resp.text(), "text/html");
}

export async function _fetchAvatarState(): Promise<AvatarState> {
  const doc = await _fetchPartialHtml(_AVATAR_EDIT_URL);
  const initialState = doc
    .querySelector("avatar-state-container")
    ?.getAttribute("initial-state");
  if (typeof initialState !== "string") {
    throw new Error(
      "Avatar edit page is not structured as expected: no avatar-state-container initial-state"
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(initialState);
  } catch (e) {
    throw new Error(
      `Avatar edit page is not structured as expected: avatar-state-container initial-state is not valid JSON: ${e}`
    );
  }
  validateAvatarState(json);
  return json;
}

export async function _fetchNftCardData(nftId: string): Promise<NftCardData> {
  const doc = await _fetchPartialHtml(`${_NFT_CARD_URL_PREFIX}${nftId}`);
  const card = doc.querySelector("product-detail-card-view");
  const name = card?.getAttribute("nft-title");
  if (!card || !name) {
    throw new Error(
      "NFT details are not structured as expected: no product-detail-card-view nft-title"
    );
  }
  const dropSize = card.getAttribute("drop-size");
  if (dropSize === null || !/^\d+$/.test(dropSize)) {
    throw new Error(
      `NFT details are not structured as expected: product-detail-card-view drop-size is not a non-negative integer: ${JSON.stringify(
        dropSize
      )}`
    );
  }
  // Unlimited series have drop-size="0"
  const seriesSize = Number(dropSize);
  return { name, seriesSize: seriesSize > 0 ? seriesSize : null };
}

export interface ResolvedAccessory {
  id: string;
  slotNumber: number;
  customizableClasses: string[];
  svgData: string;
}

export interface ResolvedAvatar {
  accessories: ResolvedAccessory[];
  styles: SVGStyle[];
  nftInfo?: NFTInfo;
}

export interface NFTInfo {
  /**
   * The unique ID of this specific NFT (i.e. including the serial numebr).
   *
   * Expected to be of the form:
   * `nft_eip155:${CHAIN_ID}_${CONTRACT_ID}_${TOKEN_ID}`
   */
  nftId: string;
  /** NFT Avatar name, including serial number, e.g. "Les Rock #478" */
  name: string;
  /**
   * The stated number of items in the series. `null` for unlimited series (e.g.
   * free NFTs).
   */
  seriesSize: number | null;
  backgroundImage: {
    httpUrl: string;
    dataUrl: string;
  };
}

export function _validateSVGStyle(obj: object): asserts obj is SVGStyle {
  if (typeof obj === "object") {
    const style = obj as Partial<SVGStyle>;
    const props = new Set(Object.getOwnPropertyNames(obj));
    if (
      props.size === 2 &&
      props.has("className") &&
      props.has("fill") &&
      typeof style.className === "string" &&
      typeof style.fill === "string"
    ) {
      return;
    }
  }
  throw new Error(
    `Style does not have expected properties: ${JSON.stringify(obj)}`
  );
}

async function _resolveAccessory(
  accessory: SlotAccessory
): Promise<ResolvedAccessory> {
  let svgData: string;
  try {
    const svgResp = await fetch(accessory.asset.imageUrl, {
      credentials: "omit",
    });
    if (!svgResp.ok)
      throw new Error(
        `Request failed: ${await _failedResponseSummary(svgResp)}`
      );
    if (!/\bimage\/svg\+xml\b/.test(svgResp.headers.get("content-type") || ""))
      throw new Error(`Response is not an image in SVG format`);
    svgData = await svgResp.text();
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    throw new Error(
      `Failed to fetch SVG data for Accessory ID ${accessory.id}: ${e.message}`
    );
  }

  return {
    id: accessory.id,
    slotNumber: accessory.asset.slotNumber,
    customizableClasses: accessory.customizableClasses,
    svgData,
  };
}

export async function _resolveNftInfo({
  nftId,
  backgroundUrl,
}: {
  nftId: string;
  backgroundUrl: string;
}): Promise<NFTInfo> {
  const [cardData, backgroundDataUrl] = await Promise.all([
    _fetchNftCardData(nftId),
    _resolveHttpImageUrlToDataUrl(backgroundUrl),
  ]);

  return {
    nftId,
    name: cardData.name,
    seriesSize: cardData.seriesSize,
    backgroundImage: { httpUrl: backgroundUrl, dataUrl: backgroundDataUrl },
  };
}

export async function _resolveHttpImageUrlToDataUrl(
  url: string
): Promise<string> {
  const resp = await fetch(url, { credentials: "omit" });
  if (!resp.ok) {
    throw new Error(`Response is not OK: ${resp.status} ${resp.statusText}`);
  }
  const contentType = resp.headers.get("content-type");
  if (!/^image\//.test(contentType || "missing content-type header")) {
    throw new Error(`Response is not an image: ${contentType}`);
  }
  const fr = new FileReader();
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    fr.onabort = reject;
    fr.onerror = reject;
    fr.onload = () => {
      if (typeof fr.result === "string") resolve(fr.result);
      else reject(new Error("result is not a string"));
    };
    fr.readAsDataURL(blob);
  });
}

/**
 * Fetch accessory data referenced by a customised Avatar description object.
 *
 * The result contains everything needed to render the Avatar as an SVG image.
 */
export async function _resolveAvatar(
  avatarState: AvatarState
): Promise<ResolvedAvatar | null> {
  const slotAccessories = Object.values(avatarState.accessoriesBySlot);
  // There are no accessories for users who've never used the avatar builder
  if (slotAccessories.length === 0) return null;

  const background = avatarState.backgroundImage;
  const futureNftInfo = background?.id.startsWith("nft_")
    ? _resolveNftInfo({ nftId: background.id, backgroundUrl: background.url })
    : undefined;
  const futureAccessories = slotAccessories.map(_resolveAccessory);
  // Fetch everything concurrently
  await Promise.allSettled([...futureAccessories, futureNftInfo]);

  return {
    accessories: await Promise.all(futureAccessories),
    styles: Object.values(avatarState.customColorsByClassName),
    nftInfo: await futureNftInfo,
  };
}

/**
 * A value that changes if the behaviour of getCurrentAvatar() changes.
 *
 * Include this in cache keys that hold avatar data to invalidate the cache when
 * getCurrentAvatar() could return a different result.
 */
export const GET_CURRENT_AVATAR_BEHAVIOUR_ID = 7;

export async function getCurrentAvatar(): Promise<ResolvedAvatar | null> {
  return _resolveAvatar(await _fetchAvatarState());
}
