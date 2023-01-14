#!/usr/bin/env bash
set -euo pipefail

function fail() {
  echo Error: ${1:?} >&2
  exit 1
}

browser_target_err="The first argument must be 'chrome' or 'firefox'"
browser_target="${1:?$browser_target_err}"
script_dir="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
repo_root="$(dirname ${script_dir:?})"

if [[ ! $browser_target =~ ^chrome|firefox$ ]]; then
  fail "$browser_target_err, not: \"$browser_target\""
fi

cd "${repo_root:?}"

dist_zip_file="${repo_root:?}/dist/dist-${browser_target:?}.zip"
dist_checksums_file="${repo_root:?}/dist/dist-${browser_target:?}-files.sha256"
dist_dir="${repo_root:?}/dist/${browser_target:?}"
[[ ! -e ${dist_zip_file:?} ]] || fail "${dist_zip_file:?} already exists"
[[ ! -e ${dist_checksums_file:?} ]] || fail "${dist_checksums_file:?} already exists"
[[ -d "${dist_dir:?}" ]] || fail "${dist_dir:?} does not exist"

cd "${dist_dir:?}" \
  && find . -type f \
  | sort \
  | xargs sha256sum \
  | tee "${dist_checksums_file:?}" \
  && find . -type f -exec \
  touch --no-dereference --date=1970-01-01T00:00:00Z {} + -print \
  | sort \
  | zip -9 -X -@ "${dist_zip_file:?}"
