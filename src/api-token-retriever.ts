import { fetchPageData } from "./page-data";

export async function getUserAPIToken() {
  const token = (await fetchPageData()).user.session.accessToken;
  console.log("access token:", token);
  return token;
}

export default getUserAPIToken;
