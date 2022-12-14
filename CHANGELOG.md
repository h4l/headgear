# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Nothing yet

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

[unreleased]:
  https://github.com/olivierlacan/keep-a-changelog/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/h4l/headgear/compare/v0.2.2...v0.3.0
[0.2.1]: https://github.com/h4l/headgear/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/h4l/headgear/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/h4l/headgear/releases/tag/v0.1.0
