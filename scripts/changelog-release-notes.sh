#!/usr/bin/env bash
set -euo pipefail

usage='Print the CHANGELOG.md section for a version, for use as release notes.

Usage:
  changelog-release-notes.sh <version> [<changelog>]

Arguments:
  <version>    The version to print, without a v prefix, e.g. 1.2.3
  <changelog>  The changelog file  [Default: CHANGELOG.md]

Exits with status 1 if the changelog has no section for the version.
'

if (( $# < 1 || $# > 2 )) || [[ ! $1 ]]; then
  printf 'Error: Invalid arguments.\n\n%s' "${usage:?}" >&2
  exit 2
fi

version=${1:?}
changelog=${2:-CHANGELOG.md}

notes=$(
  version=${version:?} awk '
    /^## \[/ { in_section = index($0, "## [" ENVIRON["version"] "]") == 1; next }
    /^\[[^]]+\]: / { in_section = 0 }
    in_section { print }
  ' "${changelog:?}"
)

# Strip leading/trailing blank lines
notes=$(sed -e '/./,$!d' <<<"${notes?}")
if [[ ! ${notes?} ]]; then
  echo "Error: ${changelog:?} has no section for version ${version@Q}" >&2
  exit 1
fi

printf '%s\n' "${notes:?}"
