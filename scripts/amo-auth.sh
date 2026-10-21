#!/usr/bin/env bash
# Print auth HTTP headers for the Firefox Add-ons API.
#
# Make an authenticated request with curl, like this:
#   $ curl -H @<(./amo-auth.sh) ...
#
# The API uses single-use JWTs to authenticate, so you must run amo-auth.sh for
# every request.
#
# The JWTs created here are documented here:
# https://mozilla.github.io/addons-server/topics/api/auth.html#access-credentials
#
# Set API credentials in environment variables:
#   AMO_JWT_ISSUER
#   AMO_JWT_SECRET
# Script dependencies: apt-get install jwt uuid
set -euo pipefail

now=$(date +%s)
expiry=$((now + 300))

claim=$(
  issuer=${AMO_JWT_ISSUER:?} nonce=$(uuid) expiry=${expiry:?} now=${now:?} \
  jq -cn '{
    "iss": env.issuer,
    "jti": env.nonce,
    "iat": env.now | tonumber,
    "exp": env.expiry | tonumber
  }'
)

# The head cmd strips trailing newline added by <<<.
token=$(
  jwt -alg HS256 -sign <(echo "${claim:?}") \
    -key <(head -c -1 <<<"${AMO_JWT_SECRET:?}")
)

echo "Authorization: JWT ${token:?}"
