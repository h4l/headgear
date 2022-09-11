function reddenPage() {
    document.body.style.backgroundColor = 'red';
    console.log('foo');
}

chrome.action.onClicked.addListener((tab) => {
    const tabId = tab.id;
    if (typeof tabId !== "number") {
        throw new Error(`tab has no id: ${tab}`);
    }
    if (!tab.url?.includes("chrome://")) {
        chrome.scripting.executeScript({
            target: { tabId },
            func: reddenPage
        });
    }
});

chrome.runtime.onInstalled.addListener(() => {
    // Make the action unavailable by default
    chrome.action.disable();

    // Enable when on reddit.com
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
        let enableOnRedditRule = {
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostSuffix: '.reddit.com' },
                })
            ],
            actions: [new chrome.declarativeContent.ShowAction()],
        };
        chrome.declarativeContent.onPageChanged.addRules([enableOnRedditRule]);
    });
});
