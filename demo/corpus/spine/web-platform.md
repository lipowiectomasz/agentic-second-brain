# Web platform traps

Browser behaviour that does not depend on the framework. Applies to React, Vue, Astro and
server-rendered templates alike.

## A `display` on `<dialog>` keeps a closed dialog visible

The user agent hides a closed dialog with `dialog:not([open]) { display: none; }`. Any
author rule that sets `display` on the dialog (`.palette { display: flex; }`, a Tailwind
`flex` utility) has higher precedence than the user agent sheet, so the dialog is rendered
on the page while closed. It is not in the top layer and has no backdrop, so it looks like
a stray panel over the content.

Restore the hiding rule next to the layout rule:

```css
dialog.palette { display: flex; flex-direction: column; }
dialog.palette:not([open]) { display: none; }
```

The same holds for an element with the `popover` attribute: the user agent hides it with
`[popover]:not(:popover-open) { display: none; }`, a class with `display: flex` keeps it on
the page while closed, and Escape seems to do nothing. Add
`.popover[popover]:not(:popover-open) { display: none; }`.

## A positioned `<dialog>` inherits `inset: 0` and `margin: auto`

The user agent centres a modal dialog with `inset: 0; margin: auto` and a `max-height`.
Setting only `top` and `left` (for a command palette at 9vh from the top) leaves
`bottom: 0` and `right: 0` in place, and the dialog stretches to the bottom of the viewport.
Override all four sides and the margin explicitly:

```css
dialog.palette { inset: 9vh auto auto 50%; margin: 0; padding: 0; height: auto; transform: translateX(-50%); }
dialog.palette::backdrop { background: var(--scrim); }
```

## Escape in a filled `<input type="search">` clears the field first

In Chromium, the first Escape in a search input that has a value clears the value and is not
treated as the dialog's cancel; the second Escape closes the dialog. Inside a command palette
this reads as "Escape does not work". Handle the key yourself:

```ts
if (event.key === "Escape") {
  event.preventDefault();
  dialog.current?.close();
}
```

The same input shows a native clear button; hide it with
`input::-webkit-search-cancel-button { appearance: none; }` when the design has its own.

## `<summary>` is not a button in the accessibility tree

Chromium exposes `<details><summary>` as a disclosure, not as a `button` role. Tests that
look for `getByRole("button", { name })` time out. Use `getByLabel` or `getByText` for a
summary, or a real `<button aria-expanded>` when the control must be announced as a button.
