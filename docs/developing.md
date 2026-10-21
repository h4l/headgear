# Headgear Developer Instructions

[![GitHub Workflow Status (with branch)](https://img.shields.io/github/actions/workflow/status/h4l/headgear/ci.yml?branch=main)](https://github.com/h4l/headgear/actions)
[![GitPOAPs](https://public-api.gitpoap.io/v1/repo/h4l/headgear/badge)][git-poap]

[git-poap]: https://www.gitpoap.io/gh/h4l/headgear

## Dev Environment

We use Node JS 24 to build & test Headgear. Newer versions should work too
though. The repository contains a Visual Studio Code devcontainer config, so
using this devcontainer is the easiest way to work on Headgear.

Release builds are made with Docker (see [Release Builds](#release-builds)).

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

See [.github/workflows/ci.yml](../.github/workflows/ci.yml) for the CI config,
and the build history at https://github.com/h4l/headgear/actions. The process
for publishing releases is described in [releasing.md](releasing.md).

CI builds with [Docker Bake](https://docs.docker.com/build/bake/), using the
[Dockerfile](../Dockerfile) and [docker-bake.hcl](../docker-bake.hcl). BuildKit
builds from the git repository at the commit being built, rather than from a
checkout, so the build only uses committed files. The build is reproducible: the
Node.js base image is pinned by digest, NPM dependencies are installed from
`package-lock.json`, and file timestamps in the `.zip` files are fixed.

The same checks and builds can be run locally with Docker:

```console
# docker buildx bake  # run prettier, eslint and the tests
...
# docker buildx bake build  # build the unpacked extensions into dist/build/
...
# docker buildx bake package  # build the release .zip files into dist/packages/
...
```

To reproduce a release build, checkout the release tag and set the environment
variables that name the release files the same way as CI does:

```console
# git checkout v0.8.0
# GITHUB_REF_TYPE=tag GITHUB_REF_NAME=v0.8.0 docker buildx bake package
...
# ls dist/packages/*/headgear-*
dist/packages/chrome/headgear-chrome-files-v0.8.0.sha256
dist/packages/chrome/headgear-chrome-v0.8.0.zip
dist/packages/firefox/headgear-firefox-files-v0.8.0.sha256
dist/packages/firefox/headgear-firefox-v0.8.0.zip
```

The `.zip` files should be identical to the ones in the GitHub Release. The
`headgear-*-files-*.sha256` files list the hashes of the files inside each
`.zip`.

Release files built by CI have
[GitHub artifact attestations](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations),
which show the commit and CI workflow run that built them. You can verify a file
downloaded from a GitHub Release using the
[GitHub CLI](https://cli.github.com/):

```console
# gh attestation verify headgear-firefox-v0.8.0.zip --repo h4l/headgear
```

Each release also includes a `headgear-*_provenance.json` file for each `.zip`,
which is the [SLSA provenance](https://slsa.dev/spec/v1.0/provenance) generated
by BuildKit, describing the build inputs.
