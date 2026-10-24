#!/usr/bin/env bash
# Print auth HTTP headers for the Chrome Web Store API.
#
# Make an authenticated request with curl, like this:
#   $ curl -H @<(./cws-auth.sh) ...
#
# CWS_ACCESS_TOKEN must be set to an OAuth Access Token with the
# https://www.googleapis.com/auth/chromewebstore scope. In CI, the
# google-github-actions/auth action obtains this token for a service account
# using Workload Identity Federation (see docs/releasing.md).
set -euo pipefail

echo "Authorization: Bearer ${CWS_ACCESS_TOKEN:?}"
