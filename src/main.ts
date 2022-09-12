chrome.action.onClicked.addListener((tab) => {
  const tabId = tab.id;
  if (typeof tabId !== "number") {
    throw new Error(`tab has no id: ${tab}`);
  }
  if (tab.url?.startsWith("https://www.reddit.com/")) {
    run(tabId).catch(console.error);
  }
});

async function run(tabId: number) {
  const token = await fetchAPIToken(tabId);
  console.log("api token:", token);
}

async function fetchAPIToken(tabId: number): Promise<string> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["api-token-retriever.js"],
  });
  const token = await results[0]?.result;
  if (typeof token !== "string") {
    throw new Error("api-token-retriever.js didn't return a string");
  }
  return token;
}

chrome.runtime.onInstalled.addListener(() => {
  // Make the action unavailable by default
  chrome.action.disable();

  // Enable when on reddit.com
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    let enableOnRedditRule = {
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { hostSuffix: "www.reddit.com" },
        }),
      ],
      actions: [new chrome.declarativeContent.ShowAction()],
    };
    chrome.declarativeContent.onPageChanged.addRules([enableOnRedditRule]);
  });
});
