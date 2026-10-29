# Definition of done

**Do not commit changes that have not been verified end to end.** Passing unit tests,
static analysis and container lint are necessary but **not sufficient** - they do not
exercise the running application.

- **Exercise every affected path in a running app**, not just in tests. Static checks miss
  runtime regressions: methods called dynamically, listeners firing on save, locale and type
  mismatches at call sites, admin UI behaviour.
- **A feature wired into a UI must be verified through that UI.** A CLI smoke test is not
  enough. The command may work while the button, background job, progress bar or context-menu
  entry it is bound to is broken or misconfigured. Run the real path, watch the feedback,
  confirm the expected log entries appear, inspect the resulting record.
  "Green on CLI" is not "done" for a panel-facing feature.
- **Beware false greens.** "No error" when nothing was actually entered or saved is not a
  pass. Assert the value that was set and read it back from storage.
- **Clean up test data.** Never commit temporary scripts, scratch files or `vendor/` edits.

## Never verify by destroying

Destructive operations on a shared or development database are off-limits as a way of
"trying something". Do not delete, truncate or mass-mutate real data to see what happens.

Use the test database, a throwaway record you created yourself, or a dry-run. Tree deletes,
`TRUNCATE` and `DELETE` without a proven-safe scope are the highest-risk actions in the
system - get explicit confirmation first.

## Test database isolation

**Never run functional or integration tests against the main development database.**
Functional tests create, modify and delete data. Before running them, confirm the kernel is
bound to the dedicated test database.

If you cannot prove the connection points at the test database, do not run the test.
