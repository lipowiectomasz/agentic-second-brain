# Closed popover stays visible

## Symptom

A confirmation popup in the web app, built on the native `popover` attribute, was visible all the time, even before it was opened. Pressing Escape appeared to do nothing: the browser did close the popover, but it stayed on screen.

## Cause

The component's class set a layout rule, `.popover { display: flex }`. The browser hides a closed popover through its own user agent rule, `[popover]:not(:popover-open) { display: none }`. Author styles win over user agent styles, so the class overrode the hiding rule and the closed popover kept being displayed.

This is the same trap as with the `<dialog>` element, where a `display` rule on the element defeats the browser's handling of the closed state.

## Resolution

Restore the hidden state explicitly with a rule at least as specific as the layout rule:

```css
.popover[popover]:not(:popover-open) {
  display: none;
}
```

After the change the popover is hidden until opened, and Escape and light dismiss close it as expected. An end-to-end test covers opening the confirmation and closing it with Escape.

## Takeaway

Never put a `display` value on an element that uses `popover` or `<dialog>` without also restating `display: none` for its closed state. Prefer applying the layout to an inner wrapper so the element itself keeps the browser defaults.
