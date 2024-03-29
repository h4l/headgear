![Headgear Banner](./docs/banner.svg)

# Headgear

[![Available in the Chrome Web Store](./docs/chrome-web-store-button.png)](https://chrome.google.com/webstore/detail/headgear/enohpjpndpodijgkfibkcpfdchjhfljp)
&nbsp;&nbsp;&nbsp;&nbsp;
[![Available from Firefox Browser Add-Ons](./docs/addons-mozilla-org-button.png)](https://addons.mozilla.org/en-GB/firefox/addon/headgear/)

Headgear makes it quick and easy to get high-quality images of your Reddit
Avatar (NFT or regular). Copy & paste a clean image of your Avatar in two clicks
from any Reddit page.

Headgear creates high-quality, resolution-independent images of Reddit Avatars
using the original vector SVG images from Reddit's Avatar Builder. The results
are sharper and more detailed than the Avatar images Reddit itself shows.

By owning an NFT Avatar, you have the right to use its images as you like.
Headgear helps you make the most of your Avatar by giving you access to the
best-possible quality images. You can create high-quality prints, images for
other social media sites, or extract Avatar accessories to create image
macros/memes or general mash-ups.

![Screenshot of Headgear](./docs/headgear-0.4.2-screenshot.png "The Headgear UI")

Headgear is a browser extension that works in Chrome or Brave. Currently
Headgear needs to be a browser extension rather than a separate website because
the data it needs to create its images is not available from Reddit's public
APIs. Headgear needs to use the internal APIs used by Reddit's own Avatar
Builder and NFT shop.

## Install

**Never enter your Reddit Vault password in a browser that has extensions
installed**. See Headgear's [security advice](./docs/security.md) for more.

<dl>
  <dt>Chrome / Edge / Brave / Opera</dt>

  <dd>
  <a target="_blank" href="https://chrome.google.com/webstore/detail/headgear/enohpjpndpodijgkfibkcpfdchjhfljp"><img align="right" src="https://img.shields.io/chrome-web-store/stars/enohpjpndpodijgkfibkcpfdchjhfljp?color=%23267dff&label=stars"></a>
  <a target="_blank" href="https://chrome.google.com/webstore/detail/headgear/enohpjpndpodijgkfibkcpfdchjhfljp"><img align="right" src="https://img.shields.io/chrome-web-store/users/enohpjpndpodijgkfibkcpfdchjhfljp?color=%23267dff"></a>
  <a target="_blank" href="https://chrome.google.com/webstore/detail/headgear/enohpjpndpodijgkfibkcpfdchjhfljp"><img alt="Available in the Chrome Web Store" src="./docs/chrome-web-store-button.png"></a>
  </dd>

  <dt>Firefox</dt>

  <dd><p>
  <a target="_blank" href="https://addons.mozilla.org/en-GB/firefox/addon/headgear/"><img align="right" src="https://img.shields.io/amo/stars/headgear?color=%23267dff"></a>
  <a target="_blank" href="https://addons.mozilla.org/en-GB/firefox/addon/headgear/"><img align="right" src="https://img.shields.io/amo/users/headgear?color=%23267dff"></a>
  <a target="_blank" href="https://addons.mozilla.org/en-GB/firefox/addon/headgear/"><img alt="Available from Firefox Browser Add-Ons" src="./docs/addons-mozilla-org-button.png"></a></p>

  <p>Headgear supports Firefox from version 109 onwards (the first version with Manifest V3 extension support).</p></dd>
<p>
  </dd>
  <dt>Microsoft Edge</dt>
  <dd>Edge can also install Headgear from the Chrome Web Store link above, but you need to explicitly allow Edge to use the Chrome Web Store. Edge will prompt you to enable it when you first visit. <a href="https://support.microsoft.com/en-us/microsoft-edge/add-turn-off-or-remove-extensions-in-microsoft-edge-9c0ec68c-2fbc-2f2c-9ff0-bdc76f46b026" target="_blank">Microsoft has instructions here</a>.</dd>
  <dt>Safari</dt>
  <dd>Safari can support Headgear, but Apple requires a $99/year Apple Developer Program membership to publish Safari extensions, so it's not practical to publish it with Apple.</dd>
</dl>

## Quickstart

- After installing, open the Reddit website, then click Headgear under the
  Extensions toolbar item
  <img src="./docs/browse-toolbar-extensions-popup.png" width="300" alt="Screenshot of browser extensions toolbar menu">

- You can Pin Headgear to keep it on the toolbar
- To uninstall Headgear, click _Manage Extensions_ under the Extensions toolbar
  icon

## Demo Video

A brief screencast demonstrating Headgear:

[![Headgear demo screencast](./docs/headgear-video-screenshot.jpg)](https://www.youtube.com/watch?v=mOUus4B1EZA "Headgear demo screencast")

## Background & Goals

Reddit's excellent [Avatar Builder] lets users to create customised avatars to
represent themselves throughout Reddit. They have a [Share Avatar] feature that
downloads a PNG image of moderate resolution (587 × 718 pixels) and no
transparency.

Reddit recently launched [Collectable Avatars] — limited-edition Avatars that
are NFTs which are owned by their holders, and can be re-sold or transferred to
other users.

[avatar builder]:
  https://www.reddit.com/r/snoovatars/comments/jipi5d/announcing_reddits_new_avatar_builder/
[share avatar]:
  https://www.reddit.com/r/snoovatars/comments/oh2v6o/share_and_swap_avatar_looks_with_the_reddit/
[collectable avatars]:
  https://www.reddit.com/r/reddit/comments/vtkmni/introducing_collectible_avatars/

### Project Goals

- Enable Reddit users to access their Avatars in the best available quality
  - Initially this means SVG format, via the SVG assets used by the Reddit
    Avatar Builder
- Decentralise Avatar assets and data:
  - So that Reddit Avatars are not lost if Reddit stops supporting them (see
    [the previous Reddit Avatars][snoovatars])
  - To enable them to be used beyond Reddit
- Be easy to use
- Have fun

[snoovatars]:
  https://venturebeat.com/business/reddit-now-lets-you-make-your-own-snoo-avatar-adds-two-new-features/

## Contributing to & Developing Headgear

[![GitHub Workflow Status (with branch)](https://img.shields.io/github/actions/workflow/status/h4l/headgear/main.yml?branch=main)](https://github.com/h4l/headgear/actions)
[![GitPOAPs](https://public-api.gitpoap.io/v1/repo/h4l/headgear/badge)][git-poap]

[git-poap]: https://www.gitpoap.io/gh/h4l/headgear

See [docs/contributing.md](docs/contributing.md). And
[docs/developing.md](docs/developing.md) for more technical info.
