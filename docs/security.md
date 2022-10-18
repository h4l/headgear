# Your Reddit Account's Security & Headgear

With the addition of NFTs, it's more important than ever to keep your Reddit
account secure, and everyone should be careful about installing browser
extensions that have access to their Reddit account.

Headgear takes the security of your Reddit account (and in particular its NFTs)
very seriously, which is why this document exists. The first part is general
advice and information for Reddit users. The second part is information on
Headgear, to help people with programming skills to audit the codebase and the
published extension.

## Part 1: Advice on browser extensions for Reddit users with NFT Avatars

The key TL;DR point is that **you must never enter your Reddit Vault password in
a web browser that has any extensions with access to Reddit**. That includes
things like ad-blockers.

If you need to enter your Reddit Vault password in Reddit (e.g. to transfer an
Avatar NFT), you should use a private browsing window without extensions
enabled, or create a clean user profile in your browser without extensions.

The reason is that an extension with access to Reddit could read your Vault
password when you type it, and use it to transfer NFTs out of your wallet.

As long as you don't enter your Vault Password, even a malicious extension with
access to Reddit would not be able to transfer your NFTs. This is because
Reddit's security architecture for the Vault uses a robust design that gives
Reddit themselves no access to your Vault's private keys. So even authenticated
API calls from your account to Reddit made by a malicious extension would not be
able to transfer your NFTs. Reddit only holds your Vault's private key in
encrypted form; it is decrypted in your browser or on your phone only, at the
point that you enter your Vault password.

## Part 2: Headgear walk-through for auditors

This is a guide of the Headgear codebase for anyone interested in understanding
what it does, with the goal of satisfying themselves that it does not do
anything undesirable.

To follow this guide you will need an understanding of Javascript and web
development, but you don't need to be familiar with browser extension
development.

## Overview

Headgear uses the [Manifest V3] browser extension API — the modern way to build
browser extensions. Manifest V3 extensions are sandboxed to prevent extension
code directly interacting with code running in web pages, or other extensions.
And fine-grained permission-based access to user data. Manifest V3 Chrome
extensions are
[not permitted to execute dynamically-sourced code](https://developer.chrome.com/docs/extensions/mv3/sandboxingEval/),
only code statically included in with browser extension.

[manifest v3]:
  https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/#feature-summary

## Headgear's Architecture

Headgear has 3 components, only one of which has access to a Reddit tab.

- The popup window
  - `popup.js` in the built extension
  - [src/popup-entry.ts](../src/popup-entry.ts) in the source code
- A background service worker
  - `background.js` in the built extension
  - [src/background-entry.ts](../src/background-entry.ts) in the source code
- A content script, run in a Reddit browser tab
  - `reddit.js` in the built extension
  - [src/reddit.ts](../src/reddit.ts) in the source code

At a high level, when a user clicks Headgear's icon on the browser's toolbar,
Headgear's main popup window is opened. The popup checks if the current browser
tab is a Reddit tab. If not, it displays an error and takes no further action
(it does not interact with the tab at all). If it is a Reddit tab, the popup
runs the `reddit.js` content script in the tab, and requests the current Avatar
data from the script. After receiving the data, the popup assembles the Avatar
image, and displays it.

Additionally, the popup saves the image style option that's selected in the UI,
so that it can remember and restore the last-used Avatar style when the popup is
closed and re-opened. It does so by sending the selected style to the background
service worker, which is responsible for saving the state to local storage.

Chrome runs each of these components in isolated environment, in the same way
that different browser tabs can't directly interact with each other. The
components can use [message passing] to communicate, and can call Manifest V3
APIs allowed by the permissions listed in the extension's `manifest.json`, which
are approved by the user either when installing, or when they're requested at
runtime.

[message passing]: https://developer.chrome.com/docs/extensions/mv3/messaging/

## Headgear's Permissions

Headgear requires 3 permissions: `activeTab`, `scripting` and `storage`. The
[`activeTab`](https://developer.chrome.com/docs/extensions/mv3/manifest/activeTab/)
permission grants Headgear access to the tab that is open when Headgear's icon
is clicked. If Headgear's icon is not clicked, it has no access to any tab. And
it never has any access to tabs other than the tab it's opened over.

The `scripting` permission gives Headgear permission to run a content script in
the context of a browser tab. It uses this to run `reddit.js`, which fetches
Avatar data from Reddit. Importantly, Manifest V3 APIs only allow execution of
code bundled with the extension — code cannot be downloaded and run.

The `storage` permission gives Headgear permission to persist data to local or
synchronised storage, which it uses to cache Avatar data, and save the state of
the UI.

## Verification strategy

Given Chrome's Manifest V3 sandboxing and permission-control, you can verify
that Headgear performs no undesirable interactions with a user's Reddit account
as follows:

1. Verify that the `manifest.json` only requests these 3 permissions.
2. Verify that the non-Reddit tabs are not interacted with, and the only
   interaction with Reddit tabs is to run the `reddit.js` content script and
   send a message to request Avatar data.
3. Verify that `reddit.js` only interacts with the Reddit tab to fetch Avatar
   data, and does not send non-Avatar data out to the extension.

Headgear is built & published without minifying the source, so the code is
reasonably readable. However, it is transpiled from TypeScript and packed with
Webpack, so reading the original TypeScript is easier. The extension includes
source maps to make it easy to run in a debugger (you can of course disable them
in your dev tools).

> (An exception to the non-minified code is the Preact dependency, because they
> only publish minified builds. Preact's source maps are included though.)

Release builds are made by GitHub Actions CI, and published to the repo's
Releases, so the build environment is verifiable. The build generates file
hashes to allow the release files to be tied to the CI build. The .zip archive
built by CI is then published to the Chrome Web store. You can use the [Chrome
extension source viewer extension] to download the version of Headgear published
on the Chrome Web store, and cross-reference the file hashes with those reported
by the CI build. Note that GitHub deletes CI logs after 90 days. All the files
should match, except for `manifest.json`, because The Chrome Web Store modifies
it to include an update URL. It's easy to see that the content matches though.

[chrome extension source viewer extension]:
  chrome-extension://jifpbeccnghkjeaalbbjmodiffmgedin/crxviewer.html?crx=https%3A%2F%2Fclients2.google.com%2Fservice%2Fupdate2%2Fcrx%3Fresponse%3Dredirect%26os%3Dmac%26arch%3Darm64%26os_arch%3Darm64%26nacl_arch%3Darm%26prod%3Dchromiumcrx%26prodchannel%3Dunknown%26prodversion%3D9999.0.9999.0%26acceptformat%3Dcrx2%2Ccrx3%26x%3Did%253Denohpjpndpodijgkfibkcpfdchjhfljp%2526uc&zipname=enohpjpndpodijgkfibkcpfdchjhfljp.zip

### Step 1.

This is nice and easy — just look at `manifest.json` from the released build.

### Step 2.

Chrome exposes Manifest V3 APIs in the `chrome.*` namespace. If you look through
the code, you'll find one location in `popup.tsx` which calls
`chrome.scripting.executeScript()` to run `reddit.js` in the active Reddit tab.
After starting the script, it sends a message to the Reddit tab, which then
responds with the Avatar data.

### Step 3.

`reddit.js` is quite short and doesn't have any bundled dependencies, so even
the raw Webpack-built Javascript is quite easy to read through. This is the only
code in the extension that runs in the context of the Reddit tab. Therefore the
only code that has the same permissions as the logged-in Reddit user. Thanks to
Chrome's [content script isolation], it can't directly interact with Reddit's
own front-end code running in the Reddit tab. It can access the DOM and make
HTTP requests with the cookies set by Reddit, just like the Javascript run
normally by a webpage.

[content script isolation]:
  https://developer.chrome.com/docs/extensions/mv3/content_scripts/#isolated_world

To fetch Avatar data, the code needs to make HTTP requests to Reddit's
`gql.reddit.com` (GraphQL) server. That requires authentication using a Bearer
token, not a cookie. Those auth tokens are sent in the initial HTML for a Reddit
page, so the code makes an HTTP request for a reddit page, parses the HTML, and
extracts the auth token from JSON data embedded in the page. (Reddit's own JS
code seems to remove this data from the initially-loaded page, so it's not
accessible from the page DOM.)

With the auth token available, the code proceeds to make a request to the
GraphQL server. It makes the same request that the Reddit Avatar Builder & Shop
make, which includes data both on the user's avatar outfit choices, and all of
the available Avatar outfits/accessories. If the user has an NFT avatar
selected, it also makes an additional HTTP request for details of the NFT, like
its serial number.

The way GraphQL queries are performed is different to a REST API. All queries
are POST requests, with a JSON body that contains an `id` field identifying the
query to invoke, and variables to parametrise the query. The code hard-codes
these query IDs. They're not human-readable, you can observe the HTTP requests
made by Reddit's own front-end code to see it performing the same queries. These
are read operations, they don't change any state.

Other than that, `reddit.js` just fetches static SVG and image assets referenced
by the Avatar data, and caches the assembled Avatar data in local storage before
sending the Avatar data out to the popup window by responding to the
`get-avatar` message sent by the popup.
