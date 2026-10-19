# Lantern

`Lantern` holds the tours of one page, starts them and remembers which ones the user has seen. It
draws nothing: `present` hands each new session to whoever owns the
[`jolly-lantern`](./element.md) element.

```ts
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import { Lantern } from "@jolly-pixel/lantern";

const lantern = new Lantern({
  storage: new LocalStorageAdapter(),
  present: (session) => {
    element.session = session;
  }
});
```

Inside an editor, `editor.host` creates it and passes it to `mount` as `context.lantern`. The
editor registers its tours and releases them when it is disposed:

```ts
const release = context.lantern.register(basics);
```

## Options

### `storage: StorageAdapter`

Where [`seen`](#lanternseen) reads and writes.

### `present?: (session: LanternSession) => void`

Called with every session `start` creates, before its first step shows.

### `page?: Document`

Passed to each step's `enter` and `until`, and the document selector targets resolve against.
Defaults to `document`.

### `warn?: (message: string) => void`

Receives the warnings of every session: a step hook that threw, a target that was not found.
Defaults to `console.warn`.

### `autoStart?: boolean`

When `false`, `lantern.offer` never starts a tour. Defaults
to `true`. `editor.host` sets it to `false` under browser automation.

## Members

### `lantern.register(tour: Tour): () => void`

Makes the tour known to the console and the toolbar and emits `change`. Registering a second tour
with the same id replaces the first. The returned function releases the registration; releasing
the tour that is running skips it without recording it as seen.

### `lantern.tour(id: string): Tour`

The registered tour with this id. Throws `UnknownTourError` when none is registered.

### `lantern.start(tour: Tour, options?: { at?: string }): LanternSession`

Starts a tour at its first step or at the step named by `at`. A tour already running is skipped
first, and is not recorded as seen. Throws `UnknownStepError` for an unknown `at`.

Finishing or skipping a tour records it in `seen` and emits `change`. Closing the page mid-tour
records nothing. A tour finished through `session.startFollowUp()` is recorded, then its follow-up
starts.

### `lantern.offer(tour: Tour): LanternSession | null`

Starts the tour for someone who has not seen it yet, such as on an editor's first load. Returns
`null` and starts nothing when `autoStart` is off, another tour is running, the tour is not
registered, or it is already seen.

### `lantern.session: LanternSession | null`

The running session.

### `lantern.size: number`

The number of registered tours. A `Lantern` is iterable over them, in registration order.

### `lantern.dispose(): void`

Skips the running session without recording it, forgets the registrations and removes every
listener.

### Events

`lantern.on("change", listener)` and `lantern.off("change", listener)`. `change` fires on
register, on release and at the end of a session.

## LanternSeen

`lantern.seen` records, per tour id, the version the user last finished or skipped. It stores the
version as a string under `jolly-pixel:lantern:<id>`, in the `StorageAdapter` it is given. It is
not synced to the project, the asset server or the other peers in a room. The editor host backs
it with the user's preferences.

### `new LanternSeen(storage: StorageAdapter)`

### `seen.has(tour: Tour): boolean`

True when the stored version is equal to or greater than `tour.version`.

### `seen.record(tour: Tour): void`

### `seen.forget(...tours: Tour[]): void`

Makes the tours unseen again. `StorageAdapter` has no removal, so this stores `"0"`. To forget
every registered tour: `lantern.seen.forget(...lantern)`.
