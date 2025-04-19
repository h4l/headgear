# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Loading avatars works again. It had
  [stopped working as a result of reddit restructuring some of its web pages](https://github.com/h4l/headgear/issues/45).
  ([#46](https://github.com/h4l/headgear/pull/46))
- Avatar data caching now works again. It had stopped working due to the HTML
  structure of reddit web pages changing.
  ([#46](https://github.com/h4l/headgear/pull/46))

### Changed

- Headgear now requests the `cookies` permission and host permissions for
  `*.reddit.com` on install, because the user auth token it needs to fetch
  avatar needs to be read from cookies, rather than from in-page data as it was
  [before this stopped working](https://github.com/h4l/headgear/issues/45).
  ([#46](https://github.com/h4l/headgear/pull/46))
  - This will result in extension users being prompted to approve the new
    permissions when they next use Headgear.

## [0.6.0] - 2023-01-26

### Added

- The NFT Card layout now supports million-sized series (e.g. 2m)
  ([#43](https://github.com/h4l/headgear/pull/43))

## [0.5.1] - 2023-01-26

### Fixed

- The hair of "Persephone, Aspect of Hades" should display correctly
  ([#30](https://github.com/h4l/headgear/pull/30))

  Avatars with complex multi-layer accessories were being rendered incorrectly,
  as the CSS styles could conflict across their layers. These are not commonly
  seen, but Persephone's hair is one example.

  Thanks to [u/SpiceWeaselBAM](https://www.reddit.com/user/SpiceWeaselBAM/) for
  reporting this issue and providing SVG data to diagnose the problem.

- The numbers in download filenames are now 0-padded to 2 digits.
  ([#32](https://github.com/h4l/headgear/pull/32))

  The new filename format introduced in 0.5.0 was supposed to sort according to
  date, but they need to be 0-padded to do that.

## [0.5.0] - 2023-01-25

### Added

- Headgear now has optional, opt-in analytics, to share usage information.
  ([#24](https://github.com/h4l/headgear/pull/24))

  If a user agrees, Headgear will share details of how the user interface is
  being used. For example, which buttons are clicked, which type of image is
  being generated, and which Avatar is being used. This information is collected
  with the aim of guiding future development work to improve Headgear. See
  [Headgear's Privacy Policy](docs/privacy-policy.md) for more info.

### Changed

- Filenames have been improved for downloaded/saved images.
  ([#25](https://github.com/h4l/headgear/pull/25))

  Previously the filenames were `Reddit Avatar ${avatar-style}.${ext}` which
  results in conflicting filenames when you download more than one, so lots of
  files with `(1)`, `(2)`, `(...n)` appended.

  The filenames now include the NFT name & serial, plus a timestamp, e.g.
  `Super Rare #1 NFT Card 2023-1-23 at 19.30.34.svg`. The timestamp is not
  localised, but its stolen from how MacOS names screenshots/recordings etc.
  Similar to ISO 8601 dates, but a bit more readable, and more importantly
  excluding / and : chars. Also sorts lexicographically with the time value,
  which is nice for filenames.

- People using the exact width/height setting will have this setting reversed.

  The serialisation of the exact image width/height has changed to fix a mistake
  in the code. If a user has the exact width/height option selected, their
  preference will be flipped from width to height or vice versa, due to the
  change in [de]serialisation introduced to fix the code. (It's not worth
  maintaining a long-term versioned migration for this minor issue in the
  codebase, sorry.)

- The most recent Reddit GQL API used to fetch Avatar data.

  This has no visible effect for users, but reduces the risk of
  Avatar-data-fetching becoming broken due to Reddit disabling an API they no
  longer use themselves. (Headgear depends on non-public APIs.)

### Fixed

- Shadows are no longer clipped on NFT Card Avatar name text.
  ([#26](https://github.com/h4l/headgear/pull/26))

  The change in 4.0.2 to render text as SVG paths introduced a subtle defect in
  the text shadow rendering — shadows were clipped with a hard edge before
  they'd fully faded out above and below the text.

## [0.4.2] - 2023-01-14

### Fixed

- Correct invalid `strict_min_version` value in Firefox manifest.
  ([#22](https://github.com/h4l/headgear/issues/22))

## [0.4.1] - 2023-01-14

### Fixed

- Enforce minimum Firefox version of 109 in the Firefox build.

## [0.4.0] - 2023-01-14

### Added

- Firefox support. Headgear supports Firefox, from version 109, due to be
  released on 2023-01-17. (This is the first version of Firefox with Manifest V3
  support, which allows Headgear to work without significant changes.)
  ([#19](https://github.com/h4l/headgear/pull/19))
- Text using custom fonts is now rendered with SVG paths instead of referencing
  web fonts from the SVG file. This removes all external dependencies, so SVG
  files are entirely stand-alone (no dependencies on Reddit keeping resources
  available). It also allows them to be rendered correctly by programs not
  capable of rendering web fonts in SVG (e.g. Inkscape).
  ([#20](https://github.com/h4l/headgear/pull/20))

## [0.3.0] - 2022-10-26

### Added

- Avatar images can be downloaded or copied as PNG files, in addition to SVG.
  ([#16](https://github.com/h4l/headgear/pull/16))
  - The size of PNG images can be changed in a new settings dialog.
  - The settings also allow switching between PNG and SVG output.
- Comment Headshot Avatar style (the upper half of the Avatar over a hexagon)
  ([#13](https://github.com/h4l/headgear/pull/13))

### Changed

- The order of the Avatar image style buttons has changed slightly
- Improve NFT Card background rendering to remove pixelated corners when scaled
  up. ([#14](https://github.com/h4l/headgear/pull/14))

### Fixed

- Remove extra padding at the bottom of the UI Headshot image style
  ([#11](https://github.com/h4l/headgear/pulls/11))

## [0.2.1] - 2022-10-20

### Fixed

- Removed unnecessary `console.log()` call

## [0.2.0] - 2022-10-20

### Added

- UI Headshot Avatar style (the upper half of the Avatar over a circle)
  ([#7](https://github.com/h4l/headgear/pull/7))

### Changed

- Updated Avatar Data API call query ID
  ([#8](https://github.com/h4l/headgear/pull/8))

### Fixed

- A regular Avatar could be rendered as an NFT Card, resulting in an error
  ([#5](https://github.com/h4l/headgear/issues/5))

## [0.1.0] - 2022-10-16

The first release.

### Added

- Create single SVG image of a customised Reddit Avatar using the individual SVG
  asset layers used internally in the Reddit Avatar Builder.
- Re-create the NFT Card and the standard "Share Avatar" images in SVG
- Download these SVG Avatar images
- Support for Chrome-based browsers

[unreleased]: https://github.com/h4l/headgear/compare/v0.5.1...HEAD
[0.6.0]: https://github.com/h4l/headgear/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/h4l/headgear/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/h4l/headgear/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/h4l/headgear/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/h4l/headgear/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/h4l/headgear/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/h4l/headgear/compare/v0.2.2...v0.3.0
[0.2.1]: https://github.com/h4l/headgear/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/h4l/headgear/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/h4l/headgear/releases/tag/v0.1.0
