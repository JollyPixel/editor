---
status: accepted
---

# `jolly-log` is an ambient feed, and `jolly-toast` stays deferred

`editors/voxel-map` needs a capped feed of short status lines beside its left dock: peers joining and
leaving, camera mode changes. That is a `role="log"` region with `aria-relevant="additions"`, never
announced twice and never interrupting. A toast is `role="alert"`, usually carries an action and a
close button, and interrupts on purpose. Building both from one element would mean one class holding
two accessibility contracts and two interaction surfaces, so `jolly-log` ships alone and
`jolly-toast` keeps its place on the deferred list.

`LogQueue` is a plain class owning the cap, the per-entry grace period and eviction, with injectable
`now` and `schedule` so expiry is deterministic under `node --test`. `jolly-log` holds no state: it
renders the array the queue hands it. No singleton and no `notify()` free function, so two editors or
four parallel Playwright workers never share a queue. Consumers keep the instance wherever their own
state lives.

An entry's `content` is a `string` or a Lit `TemplateResult`, opaque to the queue. The motivating
entry is `<Username> has joined`, and usernames arrive from other peers, so an HTML string rendered
through `unsafeHTML` would put the most attacker-controlled value in a collaborative editor straight
into a markup sink. Lit escapes interpolations, so a template gives the same colour and markup with
no sink.

The element positions nothing, per ADR-0012.

## Considered Options

- **One notification component with a `variant` attribute.** Alert and log semantics in one class, the
  shape that hit the max-lines ceiling in `PixelArtCanvas.ts`.
- **A structured segment array, `{ text, color }[]`.** Serializable and Lit-free, but it grows an
  icon field, then a style field, and ends as a private rich-text format.
- **A raw HTML string.** The XSS hole above.
- **Timers in the element.** Expiry would only be reachable from the Playwright tier, against
  ADR-0024, and the cap would have two owners.
- **Queue-owned exit animation, marking entries `expiring` before removal.** Puts a CSS duration
  inside a DOM-free module.

## Consequences

A removed entry outlives the queue by one exit transition, so rendered rows can exceed the cap by
one during that window.

Entries stop being serializable. There is no persisting, replaying or sending a log over the wire
without changing the content type first.

Announcing is on by default. A consumer whose feed is pure chrome sets `live="off"`; silence is not
the default, because for `<Username> has joined` this component is the only channel carrying the
information.
