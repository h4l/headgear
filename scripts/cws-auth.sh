#!/usr/bin/env bash
# Fetch an Access Token to make HTTP requests to the Chrome Web Store API.
#
# These envars must be set: CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN
#
# See: https://developers.google.com/identity/protocols/oauth2/web-server#offline
set -euo pipefail

# url-encode the params, without putting secret envars in argv
body=$(
  jq -ner '
  def not_empty: if (. | length) == 0 then empty else . end;
  def require_env(name):
    (env[name] | not_empty) // ("envar not set: \(name)\n" | halt_error);
  {
    client_id: require_env("CWS_CLIENT_ID"),
    client_secret: require_env("CWS_CLIENT_SECRET"),
    refresh_token: require_env("CWS_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  }
  | to_entries | map("\(.key)=\(.value | @uri)") | join("&")'
) || {
  echo "Error: Failed to url-encode CWS_ envars" >&2;
  exit 2;
}

resp_json=$(
  curl <<<"${body:?}" -d@- -fsS --max-time 30 \
    https://oauth2.googleapis.com/token
) || {
  echo "Error: Request for Access Token failed" >&2;
  exit 1;
}

scope=$(jq <<<"${resp_json:?}" -r .scope)
if [[ ${scope?} != 'https://www.googleapis.com/auth/chromewebstore' ]]; then
  echo "Error: Access Token has incorrect scope: ${scope@Q}" >&2
  exit 3
fi

access_token=$(jq <<<"${resp_json:?}" -er .access_token)
echo "Authorization: Bearer ${access_token:?}"
