# Editing in place during development

While a feature is still in development - its files exist only on the feature branch and
have **not merged to the main branch** - prefer **fixing existing files in place** over
adding new ones.

Do not accumulate `*V2`, `*Fixed`, or "repair"/"patch" files to correct something introduced
earlier in the same unmerged branch. Edit the original, amend or rework the commit if
helpful, and keep the change set minimal.

Additive patch files - a second migration to fix a first, a wrapper to shim a freshly-added
class - are reserved for changes **already shipped** to stage or prod, where rewriting
history would break other environments.

In development: one clean file per concept, not a trail of corrections.
