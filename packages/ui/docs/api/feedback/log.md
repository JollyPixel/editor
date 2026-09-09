# `jolly-log`

`jolly-log` renders a capped feed of short status messages that rise from a
bottom edge and fade once their grace period ends. It holds no state: a
[`LogQueue`](#logqueue) owns the entries and hands the element an array.

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

| Property | Attribute | Type | Default |
|---|---|---|---|
| `entries` | none | `readonly LogEntry[]` | `[]` |
| `live` | `live` | `"polite" \| "off"` | `"polite"` |
| `empty` | `empty` | `boolean` | `true` |

Entries are newest first. The host is `role="log"` with
`aria-relevant="additions"`, so expiring entries are never re-announced; set
`live="off"` for a feed that carries nothing a screen reader needs.

The element positions nothing. Place it in a container of your own, absolutely
or otherwise, and it fills that container from the bottom up:

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

The host is `pointer-events: none`, so a feed over a canvas does not swallow
clicks.

The element paints no background. A scrim for legibility over a busy viewport
belongs to the container, which can size it independently of the feed and fade
it out through `empty`, reflected while nothing is rendered, the entry still
animating out included:

```css
.viewport::before {
  content: "";
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  width: 420px;
  height: 220px;
  background: linear-gradient(
    to bottom right,
    rgb(0 0 0 / 0.8),
    transparent 70%
  );
  transition: opacity 200ms ease;
  pointer-events: none;
}

.viewport:has(jolly-log[empty])::before {
  opacity: 0;
}
```

`empty` is derived, so writing to it only holds until the next render.

| Custom property | Default |
|---|---|
| `--jolly-log-gap` | `var(--jolly-space-1)` |
| `--jolly-log-max-width` | `320px` |
| `--jolly-log-enter-duration` | `var(--jolly-duration-base)` |
| `--jolly-log-exit-duration` | `var(--jolly-duration-base)` |
| `--jolly-log-easing` | `var(--jolly-easing)` |
| `--jolly-log-color` | `var(--jolly-text)` |
| `--jolly-log-shadow` | a 1px drop shadow |
| `--jolly-log-rise` | `4px` |

A removed entry stays in the DOM until its exit transition ends, so the
rendered row count can briefly exceed the queue's cap by one. That extra row is
the eviction you are watching. Under `prefers-reduced-motion` both transitions
are dropped and rows leave on a timeout instead.

## `LogQueue`

```ts
new LogQueue({
  max: 5,
  gracePeriod: 10_000
});
```

| Option | Type | Default |
|---|---|---|
| `max` | `number` | `5` |
| `gracePeriod` | `number` | `10_000` |
| `now` | `() => number` | `Date.now` |
| `schedule` | `LogScheduler` | `setTimeout`, returning its canceller |

| Member | Behavior |
|---|---|
| `entries` | Current entries, newest first |
| `push(content)` | Appends and returns the generated id |
| `dismiss(id)` | Removes one entry ahead of its expiry |
| `clear()` | Removes every entry |
| `subscribe(listener)` | Returns its own unsubscribe function |
| `dispose()` | Cancels pending timers and drops listeners |

Each entry expires `gracePeriod` milliseconds after its own push, unless a
later push evicts it first. `subscribe` does not replay the current entries, so
read `queue.entries` once at mount if the queue may already hold some.

`content` is a `string` or a Lit `TemplateResult`. Lit escapes interpolated
values, which is what makes a peer-supplied username safe to render; building
a template with `unsafeHTML` gives that up. The queue never inspects content,
so it stays DOM-free and its tests run under `node --test`.

Pass `now` and `schedule` to drive expiry by hand in a test:

```ts
const queue = new LogQueue({
  now: () => clock.time,
  schedule: (callback, delay) => clock.at(clock.time + delay, callback)
});
```
