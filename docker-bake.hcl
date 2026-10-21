// Set in GitHub Actions to "tag" or "branch"
variable "GITHUB_REF_TYPE" { default = "" }
// Set in GitHub actions to the branch or tag name, e.g. v0.1.2
variable "GITHUB_REF_NAME" { default = "" }

group "default" {
  targets = ["tasks"]
}

group "package" {
  // Build the firefox and chrome packages, and run web-ext lint on the firefox
  // build.
  targets = ["packages", "lint-web-ext"]
}

target "tasks" {
  name = task
  matrix = {
    task = ["prettier", "eslint", "test"],
  }
  target = task
  // tests can be non-deterministic, so always re-run them
  no-cache-filter = ["test"]
  output = ["type=cacheonly"]
}

// Build the unpacked extension files for both browsers into dist/build/
target "build" {
  target = "built-files"
  output = ["type=local,dest=dist/build"]
}

function "build_tag" {
  params = []
  result = GITHUB_REF_TYPE == "tag" ? GITHUB_REF_NAME : ""
}

target "packages" {
  name = "package-${browser}"
  matrix = {
    browser = ["chrome", "firefox"]
  }
  target = "packaged-files"
  args = {
    BROWSER = browser
    BUILD_TAG = build_tag()
  }
  output = ["type=local,dest=dist/packages/${browser}"]
}

// Runs web-ext lint on the Firefox build to catch issues that will be reported
// when we submit to Firefox Add-ons.
target "lint-web-ext" {
  target = "lint-web-ext"
  output = ["type=cacheonly"]
}
