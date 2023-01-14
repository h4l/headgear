# Headgear Developer Instructions

## Dev Environment

We use Node JS 16 to build & test Headgear. Newer versions should work too
though. The repository contains a Visual Studio Code devcontainer config, so
using this devcontainer is the easiest way to work on Headgear.

## Building

Starting from a checkout of the git repository, install the NPM dependencies and
run one of the `webpack-` npm run commands. (`webpack-watch` is best while
actively working on the code.)

```console
# git clone https://github.com/h4l/headgear.git
...
# cd headgear
# npm ci
...
# npm run webpack-prod

> headgear@0.3.0 webpack-prod
> webpack --config webpack-config-prod.ts
...
```

At this point the `dist/{chrome,firefox}` dirs contain the complete extension,
ready to be loaded into the browser as a developer-mode extension.

```console
# ls dist/*
dist/chrome:
background.js      LICENSE        reddit.js.map
background.js.map  manifest.json  text-to-path-service.js
font/              popup.js       text-to-path-service.js.map
html/              popup.js.map
img/               reddit.js

dist/firefox:
background.js      LICENSE        reddit.js.map
background.js.map  manifest.json  text-to-path-service.js
font/              popup.js       text-to-path-service.js.map
html/              popup.js.map
img/               reddit.js
```

### Release Builds

Release builds are done via GitHub Actions CI to ensure (and allow anyone to
verify) that the built files are not modified between build and release, whether
intentionally or via malware.

See [.github/workflows/main.yml](.github/workflows/main.yml) for the CI config,
and the build history at https://github.com/h4l/headgear/actions.

A build can be performed locally if desired. Checkout a release tag, delete any
existing dist files, run `npm run webpack-prod`, then
`npm run assemble-release-files`, with environment variables set to mimic the
GitHub Actions CI environment:

```console
# git checkout v0.4.0
# rm -rf dist/*
# npm run webpack-prod
...
# GITHUB_REF_NAME=v0.4.0 \
GITHUB_SERVER_URL=https://github.com \
GITHUB_REPOSITORY=h4l/headgear \
GITHUB_SHA=5f774f3b863e55fba9ad0ffd9aba809dd9dae7cd \
GITHUB_RUN_ID=xxx \
npm run assemble-release-files
...
# ls headgear-* RELEASE.txt*
headgear-chrome-files-v0.4.0.sha256   headgear-firefox-v0.4.0.zip
headgear-chrome-v0.4.0.zip            RELEASE.txt
headgear-firefox-files-v0.4.0.sha256  RELEASE.txt.sha256
```

The generated files provide a tree of checksums, rooted at `RELEASE.txt.sha256`,
which verifies `RELEASE.txt`, which verifies the `headgear-*` files, and the
`headgear-*-files-*` files verify the contents of the `headgear-*.zip` files.
