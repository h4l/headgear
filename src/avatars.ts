export interface AvatarDataResponseData {
  data: AvatarData;
}

interface AvatarData {
  avatarBuilderCatalog: AvatarBuilderCatalog;
}

interface AvatarBuilderCatalog {
  accessories: AvatarAccessory[];
  avatar: null | UserAvatar;
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

export interface AvatarNFTInfoResponseData {
  data: {
    inventoryItems: {
      edges: [
        {
          node: NFTInfoResponse;
        }
      ];
    };
  };
}
interface NFTInfoResponse {
  name: string;
  drop: {
    size: null | number;
  };
  benefits: {
    avatarOutfit: {
      backgroundImage: {
        url: string;
      };
    };
  };
}

function validateAvatarNFTInfoResponseData(
  json: unknown
): asserts json is AvatarNFTInfoResponseData {
  const data = json as Partial<AvatarNFTInfoResponseData>;
  const size = data?.data?.inventoryItems?.edges?.[0]?.node?.drop?.size;
  if (
    !(
      typeof data?.data?.inventoryItems?.edges?.[0]?.node?.name === "string" &&
      (size === null || typeof size === "number") &&
      typeof data?.data?.inventoryItems?.edges?.[0]?.node?.benefits
        ?.avatarOutfit?.backgroundImage?.url === "string"
    )
  ) {
    throw new Error(
      "Avatar NFT Info API response JSON is not structured as expected"
    );
  }
}

function validateAvatarDataResponseData(
  json: unknown
): asserts json is AvatarDataResponseData {
  const msg = "Avatar Data API response JSON is not structured as expected";
  const data = json as Partial<AvatarDataResponseData>;
  if (
    !(
      Array.isArray(data?.data?.avatarBuilderCatalog?.accessories) &&
      (data?.data?.avatarBuilderCatalog?.avatar === null ||
        (typeof data?.data?.avatarBuilderCatalog?.avatar === "object" &&
          Array.isArray(data?.data?.avatarBuilderCatalog?.avatar?.styles))) &&
      typeof data?.data?.avatarBuilderCatalog?.pastAvatars === "object" &&
      Array.isArray(data?.data?.avatarBuilderCatalog?.outfits)
    )
  ) {
    throw new Error(msg);
  }
  if (data?.data?.avatarBuilderCatalog?.avatar === null) {
    return;
  }

  // We need to be strict about the contents of the style objects, as if they
  // contain unexpected properties our merged SVGs will not render as intended.
  try {
    (data.data.avatarBuilderCatalog.avatar.styles as object[]).forEach((obj) =>
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

async function _graphqlJsonApiRequest<T>({
  apiToken,
  bodyJSON,
}: {
  apiToken: string;
  bodyJSON: string;
}): Promise<T> {
  const resp = await fetch("https://gql.reddit.com/", {
    headers: {
      authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    referrer: "https://www.reddit.com/",
    referrerPolicy: "origin-when-cross-origin",
    body: bodyJSON,
    method: "POST",
    mode: "cors",
    credentials: "omit",
  });
  if (!resp.ok) {
    throw new Error(
      `Avatar Data API request failed: ${await _failedResponseSummary(resp)}`
    );
  }
  return await resp.json();
}

/**
 * These IDs identify GraphQL queries understood by Reddit's gql.reddit.com
 * GraphQL server. This is not a public API. Reddit doesn't provide access to
 * Avatar info through its public API, so the only way to get at it is via the
 * internal APIs used by the Reddit Avatar Builder and NFT shop.
 *
 * This is fundamentally the reason why Headgear is a browser extension instead
 * of a stand-alone web app. By being a browser extension, a user effectively
 * grants Headgear access to Reddit with the same permissions they themselves
 * have when logged in. An external API client gets different access tokens that
 * are not able to access these internal APIs.
 *
 * Being internal, these APIs could be changed or removed at any time. And the
 * query IDs can also change.
 *
 * The IDs can be found by using a browser's dev tools to observe HTTP requests
 * made when opening the Avatar Builder.
 *
 * TODO: We should set up a scheduled CI build to try to catch when these IDs
 *   change.
 */
// AvatarBuilderCatalogWithStorefront GQL query
export const _GQL_QUERY_ID_AVATAR_DATA = "ebab39507acd";
// GetNftDetails GQL query
export const _GQL_QUERY_ID_NFT_INFO = "e9865cc4d93d";

export async function _fetchAvatarData({
  apiToken,
}: {
  apiToken: string;
}): Promise<AvatarData> {
  const json = await _graphqlJsonApiRequest({
    apiToken,
    bodyJSON: JSON.stringify({ variables: {}, id: _GQL_QUERY_ID_AVATAR_DATA }),
  });
  validateAvatarDataResponseData(json);
  return json.data;
}

export async function _fetchAvatarNFTData({
  apiToken,
  nftId,
}: {
  apiToken: string;
  nftId: string;
}): Promise<NFTInfoResponse> {
  const json = await _graphqlJsonApiRequest({
    apiToken,
    bodyJSON: JSON.stringify({
      variables: {
        ids: [nftId],
      },
      id: _GQL_QUERY_ID_NFT_INFO,
    }),
  });
  validateAvatarNFTInfoResponseData(json);
  return json.data.inventoryItems.edges[0].node;
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

function _resolveAccessory({
  accessoryId,
  accessories,
}: {
  accessoryId: string;
  accessories: Map<string, AvatarAccessory>;
}): Promise<ResolvedAccessory>[] {
  const accessory = accessories.get(accessoryId);
  if (accessory === undefined) {
    throw new Error(
      `No accessory data is available for Accessory ID: ${accessoryId}`
    );
  }

  const resolvedAssets = accessory.assets.map(async (asset) => {
    let svgData: string;
    try {
      const svgResp = await fetch(asset.imageUrl, { credentials: "omit" });
      if (!svgResp.ok)
        throw new Error(`Request failed: ${_failedResponseSummary(svgResp)}`);
      if (
        !/\bimage\/svg\+xml\b/.test(svgResp.headers.get("content-type") || "")
      )
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
  });

  if (resolvedAssets.length === 0) {
    throw new Error(
      `Accessory ID ${accessoryId} has no asset: ${JSON.stringify(accessory)}`
    );
  }
  return resolvedAssets;
}

export function _getNftId(avatar: UserAvatar): string | null {
  const match = /\/nftv2_([^_]+)_/.exec(avatar.fullImage.url);
  if (match) {
    return atob(match[1]);
  }
  return null;
}

export async function _resolveNftInfo({
  apiToken,
  nftId,
}: {
  apiToken: string;
  nftId: string;
}): Promise<NFTInfo> {
  const nftInfoResponse = await _fetchAvatarNFTData({ apiToken, nftId });

  return {
    name: nftInfoResponse.name,
    seriesSize: nftInfoResponse.drop.size,
    backgroundImage: {
      httpUrl: nftInfoResponse.benefits.avatarOutfit.backgroundImage.url,
      dataUrl: await _resolveHttpImageUrlToDataUrl(
        nftInfoResponse.benefits.avatarOutfit.backgroundImage.url
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
export async function _resolveAvatar({
  apiToken,
  avatarData,
}: {
  apiToken: string;
  avatarData: AvatarData;
}): Promise<ResolvedAvatar | null> {
  const userAvatar = avatarData.avatarBuilderCatalog.avatar;
  // avatar is null for users who've never used the avatar builder
  if (!userAvatar) return null;
  const accessories = new Map<string, AvatarAccessory>(
    avatarData.avatarBuilderCatalog.accessories.map((acc) => [acc.id, acc])
  );
  const nftId = _getNftId(userAvatar);
  const futureNftInfo = nftId
    ? _resolveNftInfo({ apiToken, nftId })
    : undefined;
  const futureAccessories = userAvatar.accessoryIds.flatMap((accessoryId) =>
    _resolveAccessory({ accessoryId, accessories })
  );
  // Fetch everything concurrently
  await Promise.allSettled([...futureAccessories, nftId]);

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
export const GET_CURRENT_AVATAR_BEHAVIOUR_ID = 4;

export async function getCurrentAvatar({
  apiToken,
}: {
  apiToken: string;
}): Promise<ResolvedAvatar | null> {
  const avatarData = await _fetchAvatarData({ apiToken });
  return _resolveAvatar({ apiToken, avatarData });
}
