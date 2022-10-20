# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Nothing yet

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
  https://github.com/olivierlacan/keep-a-changelog/compare/v0.1.0...HEAD
[0.2.1]: https://github.com/h4l/headgear/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/h4l/headgear/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/h4l/headgear/releases/tag/v0.1.0
