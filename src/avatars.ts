interface AvatarDataResponseData {
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

interface SVGStyle {
  className: string;
  fill: string;
}

function validateAvatarDataResponseData(
  json: any
): asserts json is AvatarDataResponseData {
  if (
    !(
      typeof json?.data.avatarBuilderCatalog?.accessories === "object" &&
      typeof json?.data.avatarBuilderCatalog?.avatar === "object" &&
      typeof json?.data.avatarBuilderCatalog?.pastAvatars === "object"
    )
  ) {
    throw new Error(
      `Avatar Data API response JSON is not structured as expected`
    );
  }
}

export async function fetchAvatarData(apiToken: string): Promise<AvatarData> {
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
      `Avatar Data API request failed: ${resp.status} ${
        resp.statusText
      }: ${await resp.text()}`
    );
  }
  const json = await resp.json();
  validateAvatarDataResponseData(json);
  return json.data;
}
