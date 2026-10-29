# Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), single-line.
If a change does not fit in one line, split it into atomic commits instead of writing
a paragraph in the body.

No mentions of AI co-authorship (`Co-Authored-By` and similar).

## Staging

**Never `git add -A`, `git add .` or `git add --all`.** They pull in every untracked file -
local configuration, dumps, keys, IDE settings, working files - and these then leak
into the repository.

- `git add -u` - only files already tracked
- `git add <path>` - named, by path

This also applies to resolving conflicts during `merge`, `rebase` and `cherry-pick`, where the temptation
is greatest.

Before every commit check `git status --short` and make sure nothing with `??` is left.

## Stash

**Do not use `git stash` on your own initiative** - in any form. Untracked files end up
in a separate `stash^3` commit and are easy to lose when switching branches.

If switching branches would destroy unsaved work - stop and ask.
