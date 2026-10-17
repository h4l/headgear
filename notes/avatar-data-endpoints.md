Headgear currently uses Reddit's graphql endpoints to fetch JSON data that
describes user avatars. These endpoints are no longer present since Reddit
refactored their web UI. As a result, Headgear currently doesn't work — can't
load data. Specifically, in src/avatars.ts, `_graphqlJsonApiRequest()` is used
in two places to fetch data on the user's avatar (`_fetchAvatarData()`), and
also `_fetchAvatarNFTData()` to fetch

I've analysed the endpoints currently used by the web UI for alternative ways to
source the data Headgear needs to implement `getCurrentAvatar()` (the primary
public export of avatars.ts).

## Reddit Partial HTML

Many of Reddit's web endpoints (including the ones mentioned here) support both
HTML and a custom partial HTML response. When a GET request includes header
`accept: text/vnd.reddit.partial+html, text/html;q=0.9` it'll get back a partial
HTML response, which omits the root `<html>` tag, `<head>`, `<body>` etc. Both
ultimately contain the element we want to read data from, but the partial
version is smaller, so seems a better choice, all else equal.

## Avatar Details

Endpoint: https://www.reddit.com/avatar/edit?tab=Outfits

Example request:

```
GET https://www.reddit.com/avatar/edit?tab=Outfits
accept: text/vnd.reddit.partial+html, text/html;q=0.9

```

Significant response headers:

```
content-type: text/vnd.reddit.partial+html; charset=utf-8
```

Response body representative examples:

| path                                              | desc                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| src/**tests**/avatar-edit-response-nft.html       | An NFT avatar (background image references an NFT avatar).          |
| src/**tests**/avatar-edit-response-non-nft.html   | Avatar without an NFT background image.                             |
| src/**tests**/avatar-edit-response-no-avatar.html | Avatar edit page for a new user who hasn't used the avatar builder. |

### Notes

The `<avatar-state-container>` element's `initial-state` attribute contains JSON
data describing the user's avatar layers and background, including the NFT ID
needed to retrieve NFT details.

## NFT Details

Endpoint:
https://www.reddit.com/svc/shreddit/product-detail-card-view-data-fetcher/item/{nft_id}

Example request:

```
GET https://www.reddit.com/svc/shreddit/product-detail-card-view-data-fetcher/item/nft_eip155:137_9d8542ef1237933badbe867291f6c0434b8d315c_2713
```

Significant response headers:

```
content-type: text/vnd.reddit.partial+html; charset=utf-8
```

Response body representative examples:

| path                                                                                       | desc                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| src/**tests**/product-detail-card-view-data-fetcher-item-response-drop-size-limited.html   | An NFT with a fixed drop size (limited number of instances). |
| src/**tests**/product-detail-card-view-data-fetcher-item-response-drop-size-unlimited.html | An NFT with no drop size (unlimited number of instances).    |

### Notes

The `<product-detail-card-view>` element's attributes contain the data we need
for `NFTInfo` type in avatars.ts.

## Plan

My hypothesis is that the above two endpoints provide the data required to
re-implement avatars.ts to replace the graphql endpoints that no longer work.
Tests for avatars.ts can use the response body files referenced above, similar
to how the current tests also use static files.
