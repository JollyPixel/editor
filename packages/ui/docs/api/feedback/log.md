# `jolly-log`

`jolly-log` renders a capped feed of short status messages that rise from the
bottom and fade after a grace period. It holds no state: a
[`LogQueue`](#logqueue) owns the entries.

```ts
import {
  LogQueue,
  peerColor
} from "@jolly-pixel/ui";
import { html } from "lit";

const queue = new LogQueue();
const log = document.createElement("jolly-log");

queue.subscribe((entries) => {
  log.entries = entries;
});

queue.push("Camera switched to free fly");
queue.push(html`<b style="color: ${peerColor(3)}">Ada</b> has joined`);
```

## Properties

```ts
interface LogElement {
  entries: readonly LogEntry[]; // property only, newest first
  live: "polite" | "off"; // default "polite"
  readonly empty: boolean; // reflected, nothing rendered, exit included
}
```

- The host is `role="log"` with `aria-relevant="additions"`. Set
  `live="off"` for a feed screen readers do not need.
- A removed entry stays until its exit transition ends, so one row more than
  the cap can briefly show.
- Under `prefers-reduced-motion`, rows leave without transitions.

## Placement

The element positions nothing and paints no background. It fills its
container from the bottom up, and is `pointer-events: none`.

```css
.viewport {
  position: relative;
}

.viewport jolly-log {
  position: absolute;
  inset-inline-start: 12px;
  inset-block-end: 12px;
}
```

A legibility scrim belongs to the container, faded out through `empty`. Size
the gradient ellipse to the box so it reaches zero at every edge:

```css
.viewport::before {
  content: "";
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  width: 460px;
  height: 220px;
  background: radial-gradient(
    ellipse 100% 100% at top left,
    light-dark(rgb(255 255 255 / 0.85), rgb(0 0 0 / 0.85)),
    light-dark(rgb(255 255 255 / 0.6), rgb(0 0 0 / 0.6)) 45%,
    transparent
  );
  transition: opacity 200ms ease;
  pointer-events: none;
}

.viewport:has(jolly-log[empty])::before {
  opacity: 0;
}
```

Text and shadow follow `color-scheme`. Over a 3D viewport, set it from the
scene's backdrop rather than the UI theme:

```css
.viewport[data-backdrop="light"]::before,
.viewport[data-backdrop="light"] jolly-log {
  color-scheme: light;
}

.viewport[data-backdrop="dark"]::before,
.viewport[data-backdrop="dark"] jolly-log {
  color-scheme: dark;
}
```

## Styling

```css
jolly-log {
  --jolly-log-gap: var(--jolly-space-1);
  --jolly-log-max-width: 320px;
  --jolly-log-enter-duration: var(--jolly-duration-base);
  --jolly-log-exit-duration: var(--jolly-duration-base);
  --jolly-log-easing: var(--jolly-easing);
  --jolly-log-color: var(--jolly-text);
  --jolly-log-rise: 4px;
}
```

`--jolly-log-shadow` defaults to a 1px drop shadow, light or dark per
`color-scheme`.

## `LogQueue`

```ts
new LogQueue(options?: LogQueueOptions)

interface LogQueueOptions {
  max?: number; // default 5
  gracePeriod?: number; // ms, default 10_000
}

interface LogEntry {
  id: string;
  content: string | TemplateResult;
  createdAt: number;
}
```

### Members

- `entries`: current entries, newest first.
- `push(content)`: appends and returns the new id.
- `dismiss(id)`: removes one entry early.
- `clear()`: removes every entry.
- `subscribe(listener)`: returns its unsubscribe. It does not replay, so read
  `entries` once at mount.
- `dispose()`: cancels timers and drops listeners.

### Behaviour

- Each entry expires `gracePeriod` after its push, unless a later push evicts
  it first.
- Lit escapes interpolated values, so a peer username is safe to render.
  `unsafeHTML` gives that up.
- The queue never reads its content, so it is DOM-free.
- Expiry uses `setTimeout` and `Date.now()`. Tests drive both with
  `t.mock.timers.enable({ apis: ["setTimeout", "Date"] })`.
