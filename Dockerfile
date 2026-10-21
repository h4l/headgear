# syntax=docker/dockerfile:1

# The base image is pinned by digest so that release builds are reproducible.
FROM node:24.22.0-trixie@sha256:03795b45b3153ccaf7459e36c09d4e7ad6bdc08c5c2c2df1fce7e9f465c9103f AS node-base
SHELL ["bash", "-euo", "pipefail", "-c"]
WORKDIR /build


FROM node-base AS node-modules
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci


FROM node-base AS prettier
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    npm run prettier-check


FROM node-base AS eslint
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    npm run eslint


FROM node-base AS test
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    npm run test


FROM node-base AS build-base
RUN apt-get update && apt-get install -y zip


FROM build-base AS build
# webpack-config-prod.ts builds both the chrome and firefox extensions. The
# source mount is discarded after the RUN, so we copy the output to /dist.
RUN --mount=from=,source=.,target=.,rw \
    --mount=from=node-modules,src=/build/node_modules,target=/build/node_modules \
    <<EOF
rm -rf dist
npm run webpack-prod
cp -a dist /dist
EOF


FROM scratch AS built-files
COPY --from=build /dist/ .


FROM build AS package
ARG BROWSER SOURCE_DATE_EPOCH=0 BUILD_TAG=
RUN <<EOF
set -x

if [[ ! ${BROWSER:?} =~ ^(chrome|firefox)$ ]]; then
  echo "Error: BROWSER must be chrome or firefox: BROWSER=${BROWSER@Q}" >&2
  exit 1
fi

package_id="headgear-${BROWSER:?}-${BUILD_TAG:-dev}"
files_id="headgear-${BROWSER:?}-files-${BUILD_TAG:-dev}"

mkdir /packaged
cd "/dist/${BROWSER:?}"
find . -type f | sort | xargs sha256sum > "/packaged/${files_id:?}.sha256"
find . -type f -exec \
  touch --no-dereference --date="@${SOURCE_DATE_EPOCH:-0}" {} + -print \
  | sort \
  | zip -9 -X -@ "/packaged/${package_id:?}.zip"
EOF


FROM scratch AS packaged-files
COPY --from=package /packaged/* .


FROM node-base AS lint-web-ext-base
ARG WEB_EXT_VERSION=^10
RUN npm i -g "web-ext@${WEB_EXT_VERSION:?}"
RUN apt-get update && apt-get install -y jq


FROM lint-web-ext-base AS lint-web-ext
RUN --mount=from=,source=scripts,target=scripts,rw \
    --mount=from=built-files,source=firefox,target=/web-ext \
    scripts/web-ext-lint.sh /web-ext
