import { assert } from "./assert";

export interface AvatarDataResponseData {
  data: AvatarData;
}
const FREE_NFT_CONTRACT_ADDRESSES = Object.freeze([
  // The Singularity
  "466a330887bdf62d53f968ea824793150f07762e",
  // Drip Squad
  "bfd670667053e517a97afe56c91e4f83f1160bd3",
  // Aww Friends
  "6acb8fb82880d39c2b8446f8778a14d34ee6cfb7",
  // Meme Team
  "b9c042c3275bc49799688eea1a29b1405d02946b",
]);

interface AvatarData {
  avatarBuilderCatalog: AvatarBuilderCatalog;
  avatarStorefront: AvatarStorefront;
}

interface AvatarStorefront {
  listings: {
    edges: StoreItem[];
  };
}

interface StoreItem {
  node: {
    item: {
      drop: {
        size: number;
      };
      benefits: {
        avatarOutfit: {
          id: string;
        };
      };
    };
  };
}

interface AvatarBuilderCatalog {
  accessories: AvatarAccessory[];
  avatar: UserAvatar;
  pastAvatars: UserAvatar[];
  outfits: Array<AvatarOutfit | NftAvatarOutfit>;
}

interface AvatarOutfit {
  id: string;
}
interface NftAvatarOutfit extends AvatarOutfit {
  /** NFT name for NFT outfits. */
  title: string;
  /** The NFT's background image — only for NFT outfits. */
  backgroundImage: {
    url: string;
  };
  inventoryItem: {
    /** The NFT id, e.g. `nft_eip155:${CHAIN_ID}_${CONTRACT_ID}_${TOKEN_ID}` */
    id: string;
  };
  /** The serial number of the NFT. 0-based, the display value is this + 1. */
  tokenId: string;
  contractAddress: string;
}

interface AvatarAccessory {
  assets: AccessoryAsset[];
  isAvailableForCloset: boolean;
  capabilityRequired: null | "PREMIUM";
  customizableClasses: string[];
  defaultAccessoryId: string;
  id: string;
  sectionId: string;
  state: "RESTRICTED" | "ENABLED";
  tags: string[];
}

interface AccessoryAsset {
  accessoryId: string;
  imageUrl: string;
  slotNumber: number;
}

interface UserAvatar {
  accessoryIds: string[];
  styles: SVGStyle[];
  fullImage: {
    /**
     * The avatar rendered as a PNG.
     *
     * NFT avatars use a URL structure that contains the NFT ID encoded in
     * base64. This seems to be the only way to distinguish NFT avatars from
     * regular ones, and also the way to determine which NFT background &
     * name/serial is used for the avatar's card.
     */
    url: string;
  };
}

export interface SVGStyle {
  className: string;
  fill: string;
}

function validateAvatarDataResponseData(
  json: any
): asserts json is AvatarDataResponseData {
  const msg = "Avatar Data API response JSON is not structured as expected";
  if (
    !(
      Array.isArray(json?.data?.avatarBuilderCatalog?.accessories) &&
      typeof json?.data?.avatarBuilderCatalog?.avatar === "object" &&
      Array.isArray(json?.data?.avatarBuilderCatalog?.avatar?.styles) &&
      typeof json?.data?.avatarBuilderCatalog?.pastAvatars === "object" &&
      Array.isArray(json?.data?.avatarBuilderCatalog?.outfits) &&
      Array.isArray(json?.data?.avatarStorefront?.listings?.edges)
    )
  ) {
    throw new Error(msg);
  }

  // We need to be strict about the contents of the style objects, as if they
  // contain unexpected properties our merged SVGs will not render as intended.
  try {
    (json.data.avatarBuilderCatalog.avatar.styles as object[]).forEach((obj) =>
      _validateSVGStyle(obj)
    );
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    throw new Error(
      `${msg}. User Avatar styles are not structured as expected. ${e.message}`
    );
  }
}

async function _failedResponseSummary(resp: Response): Promise<string> {
  return `${resp.status} ${resp.statusText}: ${await resp.text()}`;
}

export async function _fetchAvatarData({
  apiToken,
}: {
  apiToken: string;
}): Promise<AvatarData> {
  const resp = await fetch("https://gql.reddit.com/", {
    headers: {
      authorization: `Bearer ${apiToken}`,
      ["Content-Type"]: "application/json",
    },
    referrer: "https://www.reddit.com/",
    referrerPolicy: "origin-when-cross-origin",
    body: '{"variables":{},"id":"d78e4dc3c12e"}',
    method: "POST",
    mode: "cors",
    credentials: "omit",
  });
  if (!resp.ok) {
    throw new Error(
      `Avatar Data API request failed: ${await _failedResponseSummary(resp)}`
    );
  }
  const json = await resp.json();
  validateAvatarDataResponseData(json);
  return json.data;
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
  name: string;
  serialNumber: string;
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

async function _resolveAccessory({
  accessoryId,
  accessories,
}: {
  accessoryId: string;
  accessories: Map<string, AvatarAccessory>;
}): Promise<ResolvedAccessory> {
  const accessory = accessories.get(accessoryId);
  if (accessory === undefined) {
    throw new Error(
      `No accessory data is available for Accessory ID: ${accessoryId}`
    );
  }
  const [asset] = accessory.assets;
  if (asset === undefined)
    throw new Error(
      `Accessory ID ${accessoryId} has no asset: ${JSON.stringify(accessory)}`
    );
  let svgData: string;
  try {
    const svgResp = await fetch(asset.imageUrl, { credentials: "omit" });
    if (!svgResp.ok)
      throw new Error(`Request failed: ${_failedResponseSummary(svgResp)}`);
    if (!/\bimage\/svg\+xml\b/.test(svgResp.headers.get("content-type") || ""))
      throw new Error(`Response is not an image in SVG format`);
    svgData = await svgResp.text();
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    throw new Error(
      `Failed to fetch SVG data for Accessory ID ${accessoryId}: ${e.message}`
    );
  }
  return {
    id: accessory.id,
    slotNumber: asset.slotNumber,
    customizableClasses: accessory.customizableClasses,
    svgData,
  };
}

export function _getNftId(avatar: UserAvatar): string | null {
  const match = /\/nftv2_([^_]+)_/.exec(avatar.fullImage.url);
  if (match) {
    return atob(match[1]);
  }
  return null;
}

function _isNftAvatarOutfit(
  avatarOutfit: AvatarOutfit | NftAvatarOutfit
): avatarOutfit is NftAvatarOutfit {
  return !!(avatarOutfit as Partial<NftAvatarOutfit>)?.backgroundImage;
}

export async function _resolveNftInfo({
  avatarData,
  nftId,
}: {
  avatarData: AvatarData;
  nftId: string;
}): Promise<NFTInfo> {
  const nftOutfit = avatarData.avatarBuilderCatalog.outfits.find(
    (outfit) => _isNftAvatarOutfit(outfit) && outfit.inventoryItem.id === nftId
  );
  if (!nftOutfit)
    throw new Error(`No outfit data is available for NFT ID: ${nftId}`);
  assert(_isNftAvatarOutfit(nftOutfit));

  let seriesSize;
  // The store data doesn't include the free NFTs so we hardcode their series
  // size (no stated limit).
  if (
    FREE_NFT_CONTRACT_ADDRESSES.includes(
      nftOutfit.contractAddress?.toLowerCase()
    )
  ) {
    seriesSize = null;
  } else {
    const nftStoreItem = avatarData.avatarStorefront.listings.edges.find(
      (storeItem) =>
        storeItem.node.item.benefits.avatarOutfit.id === nftOutfit.id
    );
    if (!nftStoreItem)
      throw new Error(
        `No store item data is available for NFT Outfit ID: ${nftOutfit.id}`
      );
    seriesSize = nftStoreItem.node.item.drop.size;
  }

  const tokenId = Number.parseInt(nftOutfit.tokenId);
  if (Number.isNaN(tokenId))
    throw new Error(`Outfit tokenId is not an integer: ${nftOutfit.tokenId}`);

  return {
    name: nftOutfit.title,
    // tokenId is 0-based, serial starts at 1
    serialNumber: `${tokenId + 1}`,
    seriesSize,
    backgroundImage: {
      httpUrl: nftOutfit.backgroundImage.url,
      dataUrl: await _resolveHttpImageUrlToDataUrl(
        nftOutfit.backgroundImage.url
      ),
    },
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
  avatarData: AvatarData
): Promise<ResolvedAvatar> {
  const userAvatar = avatarData.avatarBuilderCatalog.avatar;
  const accessories = new Map<string, AvatarAccessory>(
    avatarData.avatarBuilderCatalog.accessories.map((acc) => [acc.id, acc])
  );
  const nftId = _getNftId(userAvatar);
  const futureNftInfo = nftId
    ? _resolveNftInfo({ avatarData, nftId })
    : undefined;
  const futureAccessories = userAvatar.accessoryIds.map((accessoryId) =>
    _resolveAccessory({ accessoryId, accessories })
  );
  // Fetch everything concurrently
  await Promise.all([...futureAccessories, nftId]);

  return {
    accessories: await Promise.all(futureAccessories),
    styles: userAvatar.styles,
    nftInfo: await futureNftInfo,
  };
}

/**
 * A value that changes if the behaviour of getCurrentAvatar() changes.
 *
 * Include this in cache keys that hold avatar data to invalidate the cache when
 * getCurrentAvatar() could return a different result.
 */
export const GET_CURRENT_AVATAR_BEHAVIOUR_ID = 2;

export async function getCurrentAvatar({
  apiToken,
}: {
  apiToken: string;
}): Promise<ResolvedAvatar> {
  const avatarData = await _fetchAvatarData({ apiToken });
  return await _resolveAvatar(avatarData);
}
