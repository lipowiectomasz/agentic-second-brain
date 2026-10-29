# Secret scanner missed prefixed variable names

Relates to: "Knowledge ingestion and the document lifecycle" and "CLI synchronisation of the local knowledge tree".

## Symptom

While testing the CLI quarantine scenario, a knowledge file containing an AWS secret access key assignment, in the usual environment variable form with the variable name, an equals sign and the value, was not quarantined. The push sent it to the server, and the server, which runs the same scanner, accepted it.

Nothing else in the test suite caught it: the dedicated cloud key rule matches access key IDs, not secret access keys, and the generic rule was assumed to cover the rest.

## Cause

The generic assignment rule looks for a keyword such as `secret`, `password`, `token` or `api_key`, followed by `=` or `:` and a high-entropy value of at least 16 characters. It required the separator to come right after the keyword. In `AWS_SECRET_ACCESS_KEY` the keyword `SECRET` is followed by `_ACCESS_KEY` before the equals sign, so the pattern never matched. The same applied to names like `DATABASE_PASSWORD_PROD`.

## Resolution

The generic rule now allows up to 24 characters of variable name between the keyword and the separator. Tests cover the AWS secret access key form and a password variable with a suffix. The entropy threshold and the placeholder list are unchanged, so obvious examples are still ignored.

Since the scanner is shared, the fix applies both to the CLI check before upload and to the server check, which is the actual boundary.

## Takeaway

Secret rules keyed on words must tolerate the way real configuration names are built: keywords sit in the middle of long, prefixed and suffixed names. Test the scanner with realistic variable names, not just the bare keyword.
