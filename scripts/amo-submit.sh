#!/usr/bin/env bash
set -euo pipefail

usage='Submit a Browser Extension GitHub Release to Firefox Add-ons

Usage:
  amo-submit.sh <tag>

Environment Variables:
  AMO_JWT_ISSUER
  AMO_JWT_SECRET
    API credentials to authenticate API calls. See the API authentication docs
    for how to generate them for your account:
    https://mozilla.github.io/addons-server/topics/api/auth.html#access-credentials
  GITHUB_REPOSITORY
    The GitHub repository (owner/name) the release and attestations belong to.
  RELEASE_NAME
    Prefix of the release asset filenames (<name>-firefox-<tag>.zip).
    [Default: name of the GitHub repository]
  AMO_ADDON
    The URL slug name of the add-on in Firefox Add-ons.
    [Default: RELEASE_NAME]
  AMO_ALLOW_PRERELEASE
    If "true", submit pre-releases to the unlisted channel, which signs them
    without listing them on the public AMO site. Otherwise reject pre-releases
    by exiting with an error.

    Pre-releases must not use the same manifest version as a later stable
    release, because AMO versions are unique across channels.
    [Default: false]
'

AMO_BASE_URL=https://addons.mozilla.org
GITHUB_REPOSITORY=${GITHUB_REPOSITORY:?}
RELEASE_NAME=${RELEASE_NAME:-${GITHUB_REPOSITORY#*/}}
AMO_ADDON=${AMO_ADDON:-${RELEASE_NAME:?}}
AMO_ALLOW_PRERELEASE=${AMO_ALLOW_PRERELEASE:-false}
__scripts=$(dirname "$(readlink -f "${BASH_SOURCE[0]:?}")")

function err_exit() {
  echo "Error:" "$@" >&2
  exit "${status:-1}"
}

function log_info() {
  echo "Info:" "$@" >&2
}

if [[ $# != 1 || ! $1 ]]; then
  err_exit $'Error: Invalid arguments\n\n' "${usage:?}"
fi

tag=${1:?}

# AMO_JWT envars are need by amo-auth.sh
: "${AMO_JWT_ISSUER:?}" "${AMO_JWT_SECRET:?}"  # fail if these aren't set

dir=$(mktemp -d)

release_json=$(
  gh release view "${tag:?}" \
    --repo "${GITHUB_REPOSITORY:?}" --json isDraft,isPrerelease,assets,tarballUrl
)

if jq <<<"${release_json:?}" -e '.isDraft' > /dev/null; then
  err_exit "GitHub Release ${tag:?} is draft"
fi

# AMO has listed and unlisted channels. Pre-releases go to unlisted, which means
# they are not visible on the public AMO site, but AMO signs them with minimal
# delay, allowing us to download the .xpi and host it ourself in the GitHub
# Release.
if jq <<<"${release_json:?}" -e '.isPrerelease' > /dev/null; then
  [[ ${AMO_ALLOW_PRERELEASE:?} == true ]] \
    || err_exit "GitHub Release ${tag:?} is a pre-release and AMO_ALLOW_PRERELEASE is not true"
  release_channel=unlisted
else
  release_channel=listed
fi

# If the signed .xpi already exists in the release then we can assume it's
# already been submitted to AMO.
signed_release_asset_name="${RELEASE_NAME:?}-firefox-${tag:?}.xpi"
signed_release_asset_json=$(
  signed_release_asset_name=${signed_release_asset_name:?} \
    jq <<<"${release_json:?}" \
    'first(.assets[] | select(.name == env.signed_release_asset_name)) // null'
)

if jq <<<"${signed_release_asset_json:?}" -e > /dev/null; then
  log_info "GitHub Release ${tag:?} already contains ${signed_release_asset_name@Q}"
  release_channel=${release_channel:?} jq -cne \
    '{status: "release-has-xpi", release_channel: env.release_channel, signed_xpi_file: null}'
  exit 0
fi

release_archive_name="${RELEASE_NAME:?}-firefox-${tag:?}.zip"
release_asset_json=$(
  release_archive_name=${release_archive_name:?} jq <<<"${release_json:?}" -e \
    'first(.assets[] | select(.name == env.release_archive_name))'
)
release_archive_url=$(jq <<<"${release_asset_json:?}" -er '.url')
release_archive_file="${dir:?}/${release_archive_name:?}"
source_tarball_url=$(jq <<<"${release_json:?}" -er '.tarballUrl')
source_tarball_file="${dir:?}/${RELEASE_NAME:?}-${tag:?}.tar.gz"

log_info "Downloading GitHub release archive and source tarball..."
curl -#Lf -o "${source_tarball_file:?}" "${source_tarball_url:?}" \
  -o "${release_archive_file:?}" "${release_archive_url:?}"

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

# Check if the version already exists
log_info "Checking if release version already exists in AMO..."
version_detail_json_file="${dir:?}/version.json"
version_status=$(
  curl -sSL -o "${version_detail_json_file:?}" -w "%{http_code}" \
    -H @<("${__scripts:?}/amo-auth.sh") \
    "${AMO_BASE_URL:?}/api/v5/addons/addon/${AMO_ADDON:?}/versions/${manifest_version:?}/"
)

if [[ $version_status == 200 ]]; then
  log_info "Version ${manifest_version} (${tag:?}) already exists in AMO"
  version_detail_json=$(<"${version_detail_json_file:?}")
elif [[ $version_status != 404 ]]; then
  err_exit "Unable to determine if version exists in AMO: Unexpected HTTP status: ${version_status?}"
else # Version not yet created
  # create version
  log_info "Version ${manifest_version:?} (${tag:?}) does not yet exist in AMO"

  log_info "Uploading release archive for validation"
  upload_detail_json=$(
    curl -# -f -H @<("${__scripts:?}/amo-auth.sh") \
      -F "upload=@${release_archive_file:?}" -F "channel=${release_channel:?}" \
      "${AMO_BASE_URL:?}/api/v5/addons/upload/"
  )
  upload_uuid=$(jq <<<"${upload_detail_json:?}" -er .uuid)
  upload_uuid=${upload_uuid//\/}  # remove any / (should be no-op)

  log_info $'Waiting for upload to be validated...\n↓'
  # Try for ~10 minutes max — normally only takes 10-20 seconds
  for (( i = 0; ; i++ )); do
    if (( i >= 120 )); then
      err_exit "Timed out waiting for uploaded .zip to be validated."
    fi

    if jq <<<"${upload_detail_json:?}" -er '.processed' > /dev/null; then
      if ! jq <<<"${upload_detail_json:?}" -er '.valid' > /dev/null; then
        err_exit "Release archive failed validation after upload:", $'\n' "${upload_detail_json:?}"
      fi
      break
    fi

    sleep 5

    upload_detail_json=$(
      curl -fsSL --retry 3 -H @<("${__scripts:?}/amo-auth.sh") \
      "${AMO_BASE_URL:?}/api/v5/addons/upload/${upload_uuid:?}/"
    )
    echo '⋮' >&2
  done

  log_info "Creating version ${manifest_version:?} from validated release archive"
  version_detail_json=$(
    curl -# -f -H @<("${__scripts:?}/amo-auth.sh") \
      -F "upload=${upload_uuid:?}" \
      -F "source=@${source_tarball_file:?}" \
      "${AMO_BASE_URL:?}/api/v5/addons/addon/${AMO_ADDON:?}/versions/"
  )
  version_edit_url=$(jq <<<"${version_detail_json:?}" -er '.edit_url')
  log_info "Version created: ${version_edit_url@Q}"
fi

log_info $'Waiting for version to be approved & signed...\n↓'

# listed channel initially requires manual approval, but later it starts
# auto-approving. unlisted auto-approves by default. Usually this happens within
# a minute or two.
for (( i = 0; ; i++ )); do
  if (( i >= 120 )); then
    release_channel=${release_channel:?} jq -cne \
      '{status: "approve-timeout", release_channel: env.release_channel, signed_xpi_file: null}'
    exit 0
  fi

  # Status is initially "unreviewed" and becomes "public" when the zip is signed
  version_status=$(jq <<<"${version_detail_json:?}" -er '.file.status')
  if [[ ${version_status:?} == public ]]; then break
  elif [[ ${version_status:?} != "unreviewed" ]]; then
    err_exit "Failed to wait for version to be approved; version has status: ${version_status@Q}"
  fi

  sleep 5

  version_detail_json=$(
    curl -fsSL --retry 3 -H @<("${__scripts:?}/amo-auth.sh") \
      "${AMO_BASE_URL:?}/api/v5/addons/addon/${AMO_ADDON:?}/versions/${manifest_version:?}/"
  )
  echo '⋮' >&2
done

signed_xpi_url=$(jq <<<"${version_detail_json:?}" -er '.file.url')
signed_xpi_file="${dir:?}/${RELEASE_NAME:?}-firefox-${tag:?}.xpi"
# We have to send credentials to to the download URL so it seems prudent to
# ensure the URL is on the AMO server. (This URL is not under the /api path.)
[[ ${signed_xpi_url:?} == "${AMO_BASE_URL:?}"/*.xpi ]] \
  || err_exit "Signed .xpi download URL is not under ${AMO_BASE_URL@Q}: ${signed_xpi_url@Q}"

log_info "Downloading signed release package:" "${signed_xpi_url:?}"
curl -# -f --retry 3 -H @<("${__scripts:?}/amo-auth.sh") \
  -o "${signed_xpi_file:?}" "${signed_xpi_url:?}"

# Output the path of the downloaded signed .xpi file
release_channel=${release_channel:?} signed_xpi_file=${signed_xpi_file:?} jq -cne \
  '{status: "approved", release_channel: env.release_channel, signed_xpi_file: env.signed_xpi_file}'
