#!/usr/bin/env bash
set -euo pipefail

usage='Lint Firefox Web Extension files using web-ext.

Usage:
  web-ext-lint.sh [<directory>]

Arguments:
  <directory>  The directory containing the built extension files   [Default: .]
'
__dir=$(dirname "${BASH_SOURCE[0]}")

if (( $# > 1 )); then
  printf 'Error: Invalid arguments.\n\n%s' "${usage:?}" >&2
  exit 3;
fi

options=()
if [[ $# == 1 ]]; then options+=(--source-dir "$1"); fi

status=0
report_json=$(npx web-ext lint "${options[@]}" --output json) || status=$?

if [[ ! "${report_json?}" ]] || ! jq <<<"${report_json:?}" > /dev/null; then
  echo "Error: running web-ext did not produce JSON output; exit status ${status:?}" >&2
  exit 2
fi

# Adjust priority of issues to ignore warnings we can't/won't fix
report_json=$(jq --from-file  "${__dir:?}/reclassify-lint-issues.jq" <<<"$report_json") || {
  echo "Error: Failed to reclassify lint issues" >&2;
  exit 2;
}

errors=$(jq <<<"$report_json" .summary.errors)
warnings=$(jq <<<"$report_json" .summary.warnings)

if (( ${errors:?} > 0 )) || (( ${warnings:?} > 0 )); then
  echo "Lint detected ${errors:?} errors and ${warnings:?} warnings:" >&2
  jq <<<"$report_json"
  exit 1
fi
