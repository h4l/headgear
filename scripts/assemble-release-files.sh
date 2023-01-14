#!/usr/bin/env bash
set -euo pipefail

script_dir="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "${script_dir:?}/.."

ref_name="${GITHUB_REF_NAME:?}"     # e.g. v0.3.0
server_url="${GITHUB_SERVER_URL:?}" # e.g. https://github.com
repository="${GITHUB_REPOSITORY:?}" # e.g. h4l/headgear
sha="${GITHUB_SHA:?}"               # e.g. d69a8048d3cc6aec0d9d4abc229996528fb6ad9e
actions_run_id="${GITHUB_RUN_ID:?}" # e.g. 1658821493

PACKAGE_JSON_VERSION="$(jq -r .version package.json)"
[[ v$PACKAGE_JSON_VERSION = ${ref_name:?} ]] || {
  echo "Error: The package.json version does not match the tag. The tag must" \
    "be the version with a 'v' prefix, e.g. 'v0.0.0'." >&2;
    exit 1;
}
npm run create-release-zips
mv dist/dist-chrome.zip "headgear-chrome-${ref_name:?}.zip"
mv dist/dist-chrome-files.sha256 "headgear-chrome-files-${ref_name:?}.sha256"
mv dist/dist-firefox.zip "headgear-firefox-${ref_name:?}.zip"
mv dist/dist-firefox-files.sha256 "headgear-firefox-files-${ref_name:?}.sha256"
cat > RELEASE.txt << EOF
# Name: Headgear
# Version: $PACKAGE_JSON_VERSION
# Tag: ${ref_name:?}
# Commit: ${sha:?}
# Built-by: ${server_url:?}/${repository:?}/actions/runs/${actions_run_id:?}
EOF
sha256sum "headgear-chrome-${ref_name:?}.zip" \
          "headgear-chrome-files-${ref_name:?}.sha256" \
          "headgear-firefox-${ref_name:?}.zip" \
          "headgear-firefox-files-${ref_name:?}.sha256" \
          | tee -a RELEASE.txt
sha256sum RELEASE.txt | tee RELEASE.txt.sha256
