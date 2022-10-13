import { parsePageJSONData } from "../page-data";

test("parsePageJSONData() extracts JSON from #data element", () => {
  const html = `\
<!DOCTYPE html><html lang="en-US">
<head><title>Hi</title></head>
<body><h1>Hi</h1>
<script id="data">window.___r = {"json": true};</script>
<script></script>
</html>`;
  expect(parsePageJSONData(html)).toStrictEqual({ json: true });
});
