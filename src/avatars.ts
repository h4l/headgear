export interface AvatarDataResponseData {
  data: AvatarData;
}
interface AvatarData {
  avatarBuilderCatalog: AvatarBuilderCatalog;
}

interface AvatarBuilderCatalog {
  accessories: AvatarAccessory[];
  avatar: UserAvatar;
  pastAvatars: UserAvatar[];
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
      typeof json?.data?.avatarBuilderCatalog?.accessories === "object" &&
      typeof json?.data?.avatarBuilderCatalog?.avatar === "object" &&
      Array.isArray(json?.data?.avatarBuilderCatalog?.avatar?.styles) &&
      typeof json?.data?.avatarBuilderCatalog?.pastAvatars === "object"
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

/**
 * Fetch accessory data referenced by a customised Avatar description object.
 *
 * The result contains everything needed to render the Avatar as an SVG image.
 */
export async function _resolveAvatar({
  userAvatar,
  accessories,
}: {
  userAvatar: UserAvatar;
  accessories: Map<string, AvatarAccessory>;
}): Promise<ResolvedAvatar> {
  return {
    accessories: await Promise.all(
      userAvatar.accessoryIds.map((accessoryId) =>
        _resolveAccessory({ accessoryId, accessories })
      )
    ),
    styles: userAvatar.styles,
  };
}

export async function getCurrentAvatar({
  apiToken,
}: {
  apiToken: string;
}): Promise<ResolvedAvatar> {
  const avatarData = await _fetchAvatarData({ apiToken });
  return await _resolveAvatar({
    userAvatar: avatarData.avatarBuilderCatalog.avatar,
    accessories: new Map(
      avatarData.avatarBuilderCatalog.accessories.map((acc) => [acc.id, acc])
    ),
  });
}
