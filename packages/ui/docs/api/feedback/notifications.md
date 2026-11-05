# `jolly-notifications`

`jolly-notifications` stacks notification chips in one corner of the window.
A [`NotificationQueue`](#notificationqueue) owns the chips and their timers.

```ts
import "@jolly-pixel/ui/elements/notifications";
import { NotificationQueue } from "@jolly-pixel/ui";

const queue = new NotificationQueue();
const stack = document.createElement("jolly-notifications");
document.body.append(stack);
stack.attach(queue);

queue.notify({ tone: "success", title: "Map saved" });

const upload = queue.notify({
  tone: "loading",
  title: "Uploading \"forest.glb\"",
  progress: 0
});
upload.update({ progress: 0.5 });
upload.update({ tone: "success", title: "Uploaded \"forest.glb\"", progress: null });
```

## Properties

```ts
interface Notifications {
  placement: NotificationPlacement; // reflected, default "bottom-end"
  label: string; // aria-label, default "Notifications"
  readonly empty: boolean; // attribute only, nothing rendered, exit included
}

type NotificationPlacement =
  | "top-start" | "top-end" | "bottom-start" | "bottom-end";
```

## Methods

### attach(queue: NotificationQueue): void

Renders the queue's chips and follows its changes.

## Behaviour

- The host is a `popover="manual"` shown on connect, so it sits in the top
  layer above docks, frames and stacking contexts. It takes its theme tokens
  from where it is inserted, so mount it inside the themed tree.
- The newest chip sits nearest the corner.
- Each chip has a tone icon, an optional source line above the title, an
  optional message that keeps its line breaks, a `jolly-progress` bar when
  `progress` is a number, and a
  Dismiss button. `loading` shows a `jolly-spinner` in place of the icon.
- `error` and `warning` chips are `role="alert"`, the others `role="status"`.
- Hovering the stack or focusing a chip pauses every timer; leaving resumes
  them with the time they had left.
- Under `prefers-reduced-motion`, chips enter and leave without transitions.

## Styling

```css
jolly-notifications {
  --jolly-notifications-inset: var(--jolly-space-3);
  --jolly-notifications-width: 320px;
  --jolly-notifications-gap: var(--jolly-space-2);
  --jolly-notifications-enter-duration: var(--jolly-duration-enter);
  --jolly-notifications-exit-duration: var(--jolly-duration-exit);
  --jolly-notifications-easing: var(--jolly-easing);
  --jolly-notifications-rise: 8px;
}
```

Each chip is exposed as `::part(chip)` with a `data-tone` attribute.

## `NotificationQueue`

```ts
new NotificationQueue(options?: NotificationQueueOptions)

interface NotificationQueueOptions {
  max?: number; // default 5, at least 1
  durations?: Partial<NotificationDurations>; // ms per tone, null keeps it
}

type NotificationTone = "success" | "info" | "warning" | "error" | "loading";

interface NotificationInit {
  tone: NotificationTone;
  title: string;
  message?: string; // default ""
  progress?: number | null; // 0 to 1, default null (no bar)
  source?: string; // default "", shown above the title
  duration?: number | null; // ms, default the queue's duration for the tone
}

interface NotificationHandle {
  readonly id: string;
  update(patch: Partial<NotificationInit>): void;
  dismiss(): void;
}
```

`NotificationQueue` implements `Notifier`, the `notify` half that code
raising notifications should depend on:

```ts
interface Notifier {
  notify(init: NotificationInit): NotificationHandle;
}
```

### notify(init: NotificationInit): NotificationHandle

Adds a chip and returns the handle that updates or dismisses it.

### dismiss(id: string): void

Removes one chip early.

### clear(): void

Removes every chip.

### pause(): void

Stops every timer and keeps the time each one had left.

### resume(): void

Restarts the paused timers.

### subscribe(listener): () => void

Calls the listener with the entries, newest first, after each change, and
returns its unsubscribe. It does not replay, so read `entries` once at mount.

### dispose(): void

Cancels timers and drops entries and listeners.

### Behaviour

- `DEFAULT_NOTIFICATION_DURATIONS`: `success` 4 s, `info` 5 s, `warning`
  8 s; `error` and `loading` stay until dismissed.
- A timer starts when the chip is added and restarts when an update changes
  the tone or passes `duration`. Other updates keep it running.
- Beyond `max`, the oldest chip that is not `loading` is evicted. Loading
  chips are never evicted, so they can outnumber `max`.
- `progress` is clamped to 0 to 1; a non-finite value draws no bar.
- Updating or dismissing a removed chip does nothing.
- Expiry uses `setTimeout` and `Date.now()`. Tests drive both with
  `t.mock.timers.enable({ apis: ["setTimeout", "Date"] })`.
