# Tailwind CSS 4

## Own classes go into a cascade layer

Tailwind 4 emits its output into cascade layers: `@layer theme, base, components, utilities`.
A rule outside any layer beats every layered rule, whatever its specificity. A custom
class written straight into `globals.css` therefore wins over every utility applied
to the same element:

```html
<main class="page max-w-2xl">      <!-- max-w-2xl is ignored, .page sets max-width -->
<section class="card border-danger"> <!-- border-danger is ignored, .card sets border -->
```

Symptom: a utility appears in the DOM and in the generated CSS, but DevTools shows it
struck through by an unlayered rule with lower specificity.

Put global element rules in `@layer base` and component classes (from a design system,
your own `.btn`, `.card`) in `@layer components`:

```css
@import "tailwindcss";

:root { --surface: #fbf8f1; }

@layer base {
  body { background: var(--background); color: var(--foreground); }
}

@layer components {
  .card { background: var(--surface); border: 1px solid var(--border); }
}
```

Tokens on `:root` and the `@theme inline` mapping may stay outside layers - they only define
custom properties. `!important` inside a layer reverses the order (an important rule in
`base` beats an important rule in `utilities`), so use it only for rules that must win
everywhere, such as a focus ring.

The same applies to a stylesheet ported from a designer's HTML: wrap it in
`@layer components` before mixing it with utilities.
