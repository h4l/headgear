# Change priority of issues to ignore things we can't/won't fix.
def classify(issue):
  # lodash and the webpack runtime use Function('return this')() to locate the
  # global object. Nothing evaluates dynamic code.
  if (issue.code == "DANGEROUS_EVAL"
      and issue.message == "The Function constructor is eval."
      and (issue.file == "background.js" or issue.file == "popup.js"))
  # preact and posthog-js assign to innerHTML internally. We can't really avoid
  # it.
  or (issue.code == "UNSAFE_VAR_ASSIGNMENT"
      and issue.message == "Unsafe assignment to innerHTML"
      and issue.file == "popup.js")
  # TODO: Declare data_collection_permissions in the Firefox manifest. AMO
  # requires it for new extensions, and will require it for new versions of
  # existing extensions in the future: https://mzl.la/firefox-builtin-data-consent
  or (issue.code == "MISSING_DATA_COLLECTION_PERMISSIONS")
  then issue + {_type: "notice"}
  else issue end
;

. as $input
| $input.errors + $input.warnings + $input.notices
| map(classify(.))
| {errors: map(select(._type == "error")),
   warnings: map(select(._type == "warning")),
   notices: map(select(._type == "notice"))} as $reclassified_issues
| $input + $reclassified_issues
| . + {
  summary: {
    errors: .errors | length,
    warnings: .warnings | length,
    notices: .notices | length
  }
}
