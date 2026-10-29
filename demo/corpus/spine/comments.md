# Comments

Do **not** add explanatory comments. Code must be self-documenting through clear names -
class, method and variable names carry the intent. No class or method docblocks that merely
restate the signature, no inline `//` notes describing what the next line does.

If a fragment seems to need a comment, rename the variable, extract a method with a
meaningful name, or simplify the logic.

This covers every file type: PHP, YAML, JSON, Markdown and tests.

## The only exceptions

- **Static-analysis type annotations** PHP cannot express in a signature: `@param array<string, mixed>`,
  `@return list<string>`, `@var`, `@throws`. These are not comments in this sense - keep them
  wherever PHPStan needs them, and nothing else inside the docblock.
- **`@TODO`** markers for known follow-ups that must be removed later.
- **A single short line where the *why* is genuinely non-obvious** and cannot be expressed
  through naming - a workaround for an external quirk, a subtle ordering constraint. This is
  rare. Default to no comment.

Never add a comment unless explicitly asked for one.
