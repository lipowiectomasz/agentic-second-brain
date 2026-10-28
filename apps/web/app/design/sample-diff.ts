import type { DiffRow } from "@/lib/diff-rows";

type Line = ["same" | "add" | "del", string];

const lines: Line[] = [
  ["same", "# Git branching model"],
  ["same", ""],
  ["del", "We use Git Flow. Every change starts on a branch cut from `develop`."],
  ["add", "Work on short-lived branches cut from `main` and merge them within two days."],
  ["same", ""],
  ["same", "## Branches"],
  ["same", ""],
  ["same", "- `main` is always releasable."],
  ["same", "- Tags mark every release."],
  ["same", "- Nobody pushes to `main` directly."],
  ["same", "- Protected branches need a green build."],
  ["same", "- Stale branches are deleted after a week."],
  ["same", "- Branch names are lower case."],
  ["same", "- Branch names never contain a ticket title."],
  ["same", ""],
  ["same", "## Merging"],
  ["same", ""],
  ["del", "Merge with a merge commit so the branch history stays visible."],
  ["add", "Squash-merge after a green build. Rebase, don't merge `main` into your branch, and if a rebase gets messy, ask in #platform before force-pushing anything shared."],
  ["add", "One approving review is required."],
  ["same", ""],
  ["same", "## Naming"],
  ["same", ""],
  ["same", "- Features: `feat/<ticket>-short-name`."],
  ["same", "- Fixes: `fix/<ticket>-short-name`."],
  ["same", "- Chores: `chore/<ticket>-short-name`."],
  ["same", "- Experiments: `spike/<name>`."],
  ["same", "- Releases are tags, not branches."],
  ["same", ""],
  ["del", "- Hotfix branches: `hotfix/<version>`, cut from `main`."],
  ["add", "- Hotfix branches: `hotfix/<version>`, cut from the last release tag."],
  ["same", ""],
  ["same", "## Reviews"],
  ["same", ""],
  ["same", "Reviews happen within one working day."],
  ["same", "Authors resolve their own threads."],
  ["same", "Large changes get a short design note first."],
  ["same", "Reviewers say when a comment is optional."],
];

export const sampleDiff: DiffRow[] = (() => {
  let oldNumber = 0;
  let newNumber = 0;
  return lines.map(([kind, text]) => {
    if (kind !== "add") oldNumber += 1;
    if (kind !== "del") newNumber += 1;
    return { kind, text, oldNumber: kind === "add" ? null : oldNumber, newNumber: kind === "del" ? null : newNumber };
  });
})();
