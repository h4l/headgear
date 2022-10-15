// Every page seems to contain a script#data element containing the session data
// we need. But some pages are bigger than others. /coins doesn't have much
// going on, so it's smaller & faster than (say the homepage).
export const DEFAULT_PAGE_DATA_URL = "https://www.reddit.com/coins";

export interface PageData {
  user: User;
}
interface User {
  session: Session;
}
interface Session {
  accessToken: string;
}

export async function fetchPageData(
  pageUrl: string = DEFAULT_PAGE_DATA_URL
): Promise<PageData> {
  const resp = await fetch(pageUrl);
  if (!resp.ok) {
    throw new Error(
      `Request for data-containing page failed. \
pageUrl: ${pageUrl}, response: ${resp}`
    );
  }
  const json = parsePageJSONData(await resp.text());
  validatePageData(json);
  return json;
}

export function parsePageJSONData(html: string): object {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const dataScript = doc.querySelector("#data");
  if (!dataScript) throw new Error("page contains no #data element");
  const dataScriptContent = /^\s*window\.\w+\s*=\s*(.*?);?\s*$/m.exec(
    dataScript.innerHTML
  );
  if (!dataScriptContent)
    throw new Error("#data element's content is not structured as expected");
  return JSON.parse(dataScriptContent[1]);
}

export function validatePageData(
  pageData: unknown
): asserts pageData is PageData {
  const _pageData = pageData as Partial<PageData>;
  if (!(typeof _pageData?.user?.session?.accessToken === "string")) {
    throw new Error(`page #data JSON value is not structured as expected`);
  }
}
