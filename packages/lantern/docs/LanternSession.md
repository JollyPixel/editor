# LanternSession

The state machine of one running tour. It knows the current step, runs `enter` and its cleanup,
and emits events. It measures and draws nothing. [`lantern.start`](./Lantern.md) creates sessions;
editors do not create them by hand.

```ts
const session = lantern.start(lantern.tour("voxel-map.basics"));
session.on("end", (outcome) => logger.info({ outcome }, "tour ended"));
```

## Members

### `session.next(): Promise<void>`

Leaves the current step and shows the next one. On the last step it finishes the tour.

### `session.startFollowUp(): Promise<void>`

Finishes the tour and hands `offeredFollowUp` to the `end` event, which `Lantern` starts. Does
nothing while `offeredFollowUp` is `null`.

### `session.back(): Promise<void>`

Shows the previous step. Does nothing on the first step.

### `session.skip(): void`

Ends the tour as skipped. The state changes at once; the cleanup of the current step runs before
`end` fires.

Calls made while an `enter` is still pending are queued, not dropped: two quick presses of Next move
two steps. Leaving a step, by any of the three calls, aborts its signal and runs its cleanup before
the next step enters.

### `session.warn(message: string): void`

Logs through the `warn` option, prefixed with the tour and step ids.

### `session.tour: Tour`

### `session.offeredFollowUp: Tour | null`

`tour.followUp` on a last step that waits for no action, `null` otherwise. The overlay shows its
button only while it is set.

### `session.page: Document`

The `page` option of the `Lantern`. Steps receive it in their context, and the overlay resolves
selector targets against it.

### `session.index: number` and `session.step: TourStep`

The current step. While a step is entering, they already name it.

### `session.state: "running" | "finished" | "skipped"`

### `session.waiting: boolean`

True when the current step has an `until` hook and waits for the user instead of Next.

### `session.first: boolean` and `session.last: boolean`

## Events

`LanternSession` is an `@openally/emitt` `Emitter`. `on` returns the session; `subscribe` returns
a function that removes the listener.

### `step: (step: TourStep) => void`

Fires once the step's `enter` has settled and the step should show.

### `end: (outcome: "finished" | "skipped", followUp: Tour | null) => void`

`followUp` is the tour to start next when the session ended through `startFollowUp`, and `null`
otherwise.
