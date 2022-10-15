import fetchMock from "fetch-mock-jest";

import {
  DEFAULT_PAGE_DATA_URL,
  PageData,
  fetchPageData,
  parsePageJSONData,
} from "../page-data";

function pageData(): PageData {
  return { user: { session: { accessToken: "abc-123" } } };
}

const html = `\
<!DOCTYPE html><html lang="en-US">
<head><title>Hi</title></head>
<body><h1>Hi</h1>
<script id="data">window.___r = ${JSON.stringify(pageData())};</script>
<script></script>
</html>`;

beforeEach(() => {
  fetchMock.restore();
});

test("parsePageJSONData() extracts JSON from #data element", () => {
  expect(parsePageJSONData(html)).toStrictEqual(pageData());
});

test("fetchPageData()", async () => {
  fetchMock.get(DEFAULT_PAGE_DATA_URL, { body: html });
  await expect(fetchPageData()).resolves.toStrictEqual(pageData());
});
