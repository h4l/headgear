import { fetchPageData } from "./page-data";
import { fetchAvatarData } from "./avatars";

export async function fetchUserAPIToken() {
  const token = (await fetchPageData()).user.session.accessToken;
  return token;
}

export async function main() {
  const token = await fetchUserAPIToken();
  console.log("access token:", token);
  const avatarData = await fetchAvatarData(token);
  console.log("avatar data:", avatarData);
  return token;
}

export default main;
