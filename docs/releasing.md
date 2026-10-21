# Releasing Headgear

Releases are built, published and submitted to the browser extension stores by
GitHub Actions. The release files are never built or handled on a developer's
machine, so the whole process is visible in the CI logs, and the release files
can be verified using their attestations (see
[Release Builds](developing.md#release-builds)).

## Overview

1. Pushing a `v*` tag runs the [ci workflow](../.github/workflows/ci.yml), which
   builds the Chrome and Firefox `.zip` packages, creates attestations for them,
   and creates a **draft** GitHub Release containing them.
2. Publishing the draft GitHub Release triggers the
   [deploy_cws](../.github/workflows/deploy_cws.yml) and
   [deploy_amo](../.github/workflows/deploy_amo.yml) workflows. These download
   the `.zip` packages from the GitHub Release, verify their attestations, and
   submit them to the Chrome Web Store and Firefox Add-ons.

Pre-releases (versions with a pre-release suffix, like `1.2.3-rc.1`) are built
and get a draft GitHub pre-release, but are not submitted to the stores. Their
`manifest.json` version is the same as the stable version they precede (e.g.
`1.2.3`), so the stores would not accept the stable version after them.

## Making a release

1. Update the `version` in `package.json` (and `package-lock.json`):

   ```console
   # npm version --no-git-tag-version 1.2.3
   ```

2. Move the `[Unreleased]` changes in `CHANGELOG.md` to a section for the new
   version, like `## [1.2.3] - 2026-01-30`. The release notes of the GitHub
   Release are taken from this section. CI fails to create the release of a
   stable version that doesn't have a `CHANGELOG.md` section.

3. Commit the changes, then create and push the release tag:

   ```console
   # npm run create-git-release-tag
   # git push origin main v1.2.3
   ```

   CI fails if the tag does not match the `package.json` version.

4. Once CI has finished, review the draft release on the
   [GitHub Releases page](https://github.com/h4l/headgear/releases). It contains
   the `.zip` package for each browser, the hashes of the files in each package,
   and the provenance of each package.

5. Publish the draft release. This starts the store submission workflows. Check
   their progress on the
   [Actions page](https://github.com/h4l/headgear/actions).
   - **Chrome Web Store**: the package is uploaded. If the `CWS_PUBLISH_TYPE`
     variable is set, it's also submitted for review. Otherwise, submit it for
     review from the
     [Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
   - **Firefox Add-ons**: the package is submitted to the listed channel, along
     with the release's source code tarball for review. If AMO approves and
     signs the version within about 10 minutes, the signed `.xpi` is attached to
     the GitHub Release. AMO release notes are not set automatically.

   Both workflows can be re-run safely. They do nothing if the version has
   already been submitted.

## One-time setup

The store submission workflows use GitHub
[Environments](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
to hold the store credentials. Create them in the repository settings:

### `Chrome Web Store` environment

| Name                  | Type     | Value                                                                                                                                                                                     |
| --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CWS_PUBLISHER_ID`    | Variable | The publisher ID, from the Developer Dashboard's Account page                                                                                                                             |
| `CWS_ITEM_ID`         | Variable | `enohpjpndpodijgkfibkcpfdchjhfljp`                                                                                                                                                        |
| `CWS_PUBLISH_TYPE`    | Variable | Empty to only upload, `DEFAULT_PUBLISH` to submit for review and publish when approved, or `STAGED_PUBLISH` to submit for review, then publish manually from the Dashboard after approval |
| `CWS_WIF_PROVIDER`    | Variable | The Workload Identity Provider (see below), like `projects/<project number>/locations/global/workloadIdentityPools/github/providers/headgear`                                             |
| `CWS_SERVICE_ACCOUNT` | Variable | The service account's email (see below)                                                                                                                                                   |

The Chrome Web Store environment has no secrets. CI authenticates using the
GitHub Actions OIDC token of the job running in this environment.

### `Firefox Add-ons` environment

| Name             | Type   | Value                       |
| ---------------- | ------ | --------------------------- |
| `AMO_JWT_ISSUER` | Secret | AMO API key (JWT issuer)    |
| `AMO_JWT_SECRET` | Secret | AMO API secret (JWT secret) |

Generate the AMO API credentials at
https://addons.mozilla.org/en-US/developers/addon/api/key/ (see the
[AMO API authentication docs](https://mozilla.github.io/addons-server/topics/api/auth.html)).

Optionally, add required reviewers to the environments' deployment protection
rules, so that each store submission needs to be approved before it runs.

### Chrome Web Store API credentials

The Chrome Web Store provides an
[API](https://developer.chrome.com/docs/webstore/using-api) that can upload and
publish new extension versions. CI authenticates to it as a Google Cloud
[service account](https://developer.chrome.com/docs/webstore/service-accounts),
using Workload Identity Federation (WIF). The
[google-github-actions/auth](https://github.com/google-github-actions/auth)
action exchanges the job's GitHub Actions OIDC token for a short-lived Access
Token for the service account, which [cws-auth.sh](../scripts/cws-auth.sh) uses
to authenticate the API requests. There are no long-lived credentials.

Set this up by following the action's
[Workload Identity Federation through a Service Account](https://github.com/google-github-actions/auth#indirect-wif)
instructions, with these differences:

- Enable the Chrome Web Store API in the Google Cloud project.
- Restrict the provider's attribute condition to this repository's
  `Chrome Web Store` environment, so that the environment's deployment
  protection rules also protect the Chrome Web Store credentials. Use the
  numeric repository ID (`gh api repos/h4l/headgear --jq .id`) rather than the
  name, which could be re-used by a different repository:

  - Attribute mapping:
    `google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.environment=assertion.environment`
  - Attribute condition:
    `assertion.repository_id == '<repo id>' && assertion.environment == 'Chrome Web Store'`
  - Grant `roles/iam.workloadIdentityUser` on the service account to
    `principalSet://iam.googleapis.com/projects/<project number>/locations/global/workloadIdentityPools/<pool>/attribute.repository_id/<repo id>`

- Don't grant the service account any Google Cloud roles. Instead, add its email
  on the Account page of the Chrome Web Store
  [Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
- Don't grant anyone else permission to impersonate the service account (e.g.
  `roles/iam.serviceAccountTokenCreator`), so it can only be used from CI.
- Set the `CWS_WIF_PROVIDER` and `CWS_SERVICE_ACCOUNT` variables of the
  `Chrome Web Store` environment.

If the GitHub environment is renamed, the attribute condition must be updated to
match. To revoke CI's access, remove the service account from the Developer
Dashboard, or disable the WIF provider or the service account.
