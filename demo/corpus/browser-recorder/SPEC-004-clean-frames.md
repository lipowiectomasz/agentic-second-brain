# Clean Recording Frames

## Problem

A recording of a real site often opens with a consent notice over the content. Development builds show a framework debug bar. A sticky header follows every scroll and covers exactly the part the recording should show. Carousels make two recordings of the same page differ. The worker injected nothing into pages, so all of this landed in the frames, and a cookie notice also cost automation steps because the model tried to dismiss it.

## Design

Before a page reaches the capture, the recorder changes it with a static script and style sheet registered as a new-document init script through the DevTools protocol, so the rules apply before the first paint of every page, after every navigation and in every tab the browser opens. The model works on the cleaned page too, so its screenshots and the recording show the same picture.

The style sheet hides a curated list of known consent tools and framework debug bars by selector. The script adds rules that a selector list cannot express. For each element whose computed position is `fixed` or `sticky`, a pure classification function decides from its geometry: a full-width bar at the top edge is released into normal flow (fixed becomes absolute, sticky becomes static), so it stays at the top of the document, stays clickable and scrolls away; a full-width fixed bar at the bottom edge is hidden, since these are chat launchers, consent bars and promotions, not content. Elements narrower than 60 percent of the viewport (sticky table headers, floating buttons) and taller than 40 percent (full-screen overlays) are kept. Anything inside `role="dialog"` or `aria-modal="true"` is never touched, because a modal may be exactly what the task should record. When a consent notice matched, the script also unlocks page scrolling that the notice had disabled.

Animations and transitions are shortened to 1 ms rather than 0, so `animationend` and `transitionend` still fire, and the browser reports `prefers-reduced-motion: reduce`, which well-built sites honour by stopping autoplay. Images and frames with `loading="lazy"` are switched to eager. The script re-runs on DOM mutations with a 150 ms debounce, handles a batch in under 5 ms on the fixture pages, and stops observing after 2000 batches per document.

Cleaning is on by default with a per-task switch. With the switch off, nothing is injected and the motion setting is untouched, so a page can be recorded exactly as a visitor sees it.

## Decisions and alternatives

Sticky headers are released, not hidden, because `display: none` makes navigation unusable. No request headers are changed: a header that marks the request as a script call disables some debug bars, but the server then renders a different page. Rejected: letting the model dismiss notices (costs steps, shows in the recording, stores a consent choice); replacing `IntersectionObserver` to force all lazy content (infinite-scroll pages then load forever); an ad blocker filter list (large, changes weekly, blocks requests and changes the page beyond the frame); cleaning only the captured frames (the model would see a different page).

The browser automation library (`browser-use` 0.13.10) already loads default extensions, including a cookie notice blocker. Whatever the decision on keeping them, switching cleaning off must disable them too.

## Risks and acceptance

A custom consent notice that matches no selector and is not a bottom bar stays visible; a centred custom consent dialog stays because the dialog rule protects modals. A page that measures mid-animation state may misbehave. JavaScript carousels that ignore reduced motion still change slides, though every frame is sharp. Images loaded by a site's own scroll listener may appear a frame late. For each of these the per-task switch is the escape hatch.

Acceptance is measured on the fixture site by counting pixels of unique marker colours in the recorded GIF: no frame shows more than 50 pixels of the consent or debug colours with cleaning, and more than 1000 without; after the first scroll the header colour is gone from the top 80 rows but present in the first frame; the header link still works; content boxes move by at most 1 px; two recordings of an idle page have equal frame hashes at 3 seconds; a late notice is removed and scrolling unlocked; a modal and its backdrop stay. Request blocking and a user-editable selector list are out of scope.
