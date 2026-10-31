#!/usr/bin/env bash
set -euo pipefail

usage='Submit a Browser Extension GitHub Release to Chrome Web Store

Usage:
  cws-submit.sh <tag>

Environment Variables:
  CWS_PUBLISHER_ID
    ID of the publisher account in Chrome Web Store (Developer Dashboard >
    Account > Publisher ID).
  CWS_ITEM_ID
    ID of the extension in Chrome Web Store.
  CWS_PUBLISH_TYPE
    If set, submit the uploaded version for review and publishing. Can be
    DEFAULT_PUBLISH (publish as soon as it is approved) or STAGED_PUBLISH
    (publish manually from the Developer Dashboard after approval). If empty,
    the uploaded version is left as a draft.  [Default: ""]
  CWS_ACCESS_TOKEN
    OAuth Access Token with the chromewebstore scope, used by cws-auth.sh.
  GITHUB_REPOSITORY
    The GitHub repository (owner/name) the release and attestations belong to.
  RELEASE_NAME
    Prefix of the release asset filenames (<name>-chrome-<tag>.zip).
    [Default: name of the GitHub repository]
'

# This uses version 2 of the Chrome Web Store API:
# https://developer.chrome.com/docs/webstore/api/reference/rest
CWS_BASE=https://chromewebstore.googleapis.com
GITHUB_REPOSITORY=${GITHUB_REPOSITORY:?}
RELEASE_NAME=${RELEASE_NAME:-${GITHUB_REPOSITORY#*/}}
__scripts=$(dirname "$(readlink -f "${BASH_SOURCE[0]:?}")")

function err_exit() {
  echo "Error:" "$@" >&2
  exit "${status:-1}"
}

function log_info() {
  echo "Info:" "$@" >&2
}

if [[ $# != 1 || ! $1 ]]; then
  err_exit $'Invalid arguments\n\n' "${usage:?}"
fi

: "${CWS_PUBLISHER_ID:?}" "${CWS_ITEM_ID:?}"  # fail if these aren't set
CWS_PUBLISH_TYPE=${CWS_PUBLISH_TYPE:-}
if [[ "${CWS_PUBLISH_TYPE?}" && ! "${CWS_PUBLISH_TYPE:?}" =~ ^(DEFAULT_PUBLISH|STAGED_PUBLISH)$ ]]; then
  err_exit "CWS_PUBLISH_TYPE can be '', 'DEFAULT_PUBLISH' or 'STAGED_PUBLISH', got: ${CWS_PUBLISH_TYPE@Q}"
fi

# URL-encode the IDs
item_name=$(
  jq -ner --arg publisher "${CWS_PUBLISHER_ID:?}" --arg item "${CWS_ITEM_ID:?}" \
    '"publishers/\($publisher | @uri)/items/\($item | @uri)"'
)

tag=${1:?}
dir=$(mktemp -d)

release_json=$(gh release view "${tag:?}" --json isDraft,isPrerelease,assets)

if jq <<<"${release_json:?}" -e '.isDraft' > /dev/null; then
  err_exit "GitHub Release ${tag:?} is draft"
fi

# Our pre-release versions have the same manifest version as the stable release,
# so they can't be submitted to the Chrome Web Store.
if jq <<<"${release_json:?}" -e '.isPrerelease' > /dev/null; then
  err_exit "GitHub Release ${tag:?} is a pre-release"
fi

release_archive_name="${RELEASE_NAME:?}-chrome-${tag:?}.zip"
release_asset_json=$(
  release_archive_name=${release_archive_name:?} jq <<<"${release_json:?}" -e \
    'first(.assets[] | select(.name == env.release_archive_name))'
) || err_exit "GitHub Release ${tag:?} has no asset named ${release_archive_name@Q}"
release_archive_url=$(jq <<<"${release_asset_json:?}" -er '.url')
release_archive_file="${dir:?}/${release_archive_name:?}"

log_info "Downloading GitHub release archive..."
curl -fsSL -o "${release_archive_file:?}" "${release_archive_url:?}"

# Validate the authenticity of the release archive by ensuring it was built in CI
log_info "Verifying release archive attestation..."
gh attestation verify "${release_archive_file:?}" \
  --repo "${GITHUB_REPOSITORY:?}" \
  --signer-workflow "${GITHUB_REPOSITORY:?}/.github/workflows/ci.yml@refs/tags/${tag:?}" \
  >&2

manifest_json=$(unzip -qc "${release_archive_file:?}" manifest.json)
manifest_version=$(jq <<<"${manifest_json:?}" -er .version)
[[ $manifest_version =~ ^[0-9.]+$ ]] || err_exit "invalid manifest version: ${manifest_version@Q}"
[[ v$manifest_version == "${tag:?}" ]] \
  || err_exit "manifest version ${manifest_version@Q} does not match tag ${tag@Q}"

cws_auth_header=$("${__scripts:?}/cws-auth.sh")

function cws_curl() {
  curl -H @<(printf '%s\n' "${cws_auth_header:?}") -sS --fail-with-body "$@"
}

function fetch_status() {
  cws_curl --retry 3 "${CWS_BASE:?}/v2/${item_name:?}:fetchStatus"
}

status_json=$(fetch_status)

# The highest version that is published or submitted for review. Empty if
# neither exists (e.g a new item).
cws_version=$(
  jq <<<"${status_json:?}" -r '
    def digits: split(".") | map(tonumber);
    [.publishedItemRevisionStatus, .submittedItemRevisionStatus
     | .distributionChannels[]?.crxVersion // empty]
    | max_by(digits) // ""'
)

# Check if this version is newer than the version already on CWS. This script is
# intended to be idempotent, so having already submitted is not an error.
if [[ ${cws_version?} ]] && manifest_version=${manifest_version:?} cws_version=${cws_version:?} jq -ne '
    def digits(version): version | split(".") | map(tonumber);
    digits(env.manifest_version) <= digits(env.cws_version)' > /dev/null; then
  log_info "Up-to-date: Tag version ${tag:?} is <= Chrome Web Store version ${cws_version@Q}"
  exit 0
fi

log_info "Uploading release archive..."
upload_json=$(
  cws_curl -X POST -T "${release_archive_file:?}" \
    "${CWS_BASE:?}/upload/v2/${item_name:?}:upload"
) || status=2 err_exit "Failed to upload release archive:"$'\n' "${upload_json?}"

upload_state=$(jq <<<"${upload_json:?}" -er '.uploadState')

# Large uploads can be processed asynchronously. (The API docs refer to the
# in-progress state as both IN_PROGRESS and UPLOAD_IN_PROGRESS.)
for (( i = 0; ; i++ )); do
  if [[ ! ${upload_state:?} =~ ^(UPLOAD_)?IN_PROGRESS$ ]]; then break; fi
  if (( i >= 60 )); then err_exit "Timed out waiting for upload to be processed"; fi

  log_info "Upload is in progress, waiting..."
  sleep 5
  upload_state=$(fetch_status | jq -er '.lastAsyncUploadState')
done

if [[ ${upload_state:?} != "SUCCEEDED" ]]; then
  status=2 err_exit "Upload did not succeed: uploadState: ${upload_state@Q}"$'\n' "${upload_json:?}"
fi
log_info "Uploaded version ${manifest_version:?}"

if [[ ! "${CWS_PUBLISH_TYPE?}" ]]; then
  log_info "CWS_PUBLISH_TYPE is not set: The uploaded version has not been" \
    "submitted for review. Submit it from the Developer Dashboard:" \
    "https://chrome.google.com/webstore/devconsole/"
  exit 0
fi

log_info "Submitting item for review with publishType ${CWS_PUBLISH_TYPE@Q}"
publish_json=$(
  jq -nc --arg publish_type "${CWS_PUBLISH_TYPE:?}" '{publishType: $publish_type}' \
    | cws_curl -X POST -H "Content-Type: application/json" --data-binary @- \
      "${CWS_BASE:?}/v2/${item_name:?}:publish"
) || status=3 err_exit "Publish request failed:"$'\n' "${publish_json?}"

publish_state=$(jq <<<"${publish_json:?}" -er '.state')
log_info "Submitted version ${manifest_version:?}: state: ${publish_state:?}"
