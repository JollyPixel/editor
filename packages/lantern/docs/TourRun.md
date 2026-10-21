# TourRun

The state machine of one running tour. It knows the current step, runs `enter` and its cleanup,
and emits events. It measures and draws nothing. [`lantern.start`](./Lantern.md) creates runs;
editors do not create them by hand.

```ts
const run = lantern.start(lantern.tour("voxel-map.basics"));
run.on("end", (outcome) => logger.info({ outcome }, "tour ended"));
```

## Members

### `run.next(): Promise<void>`

Leaves the current step and shows the next one. On the last step it finishes the tour.

### `run.startFollowUp(): Promise<void>`

Finishes the tour and hands `offeredFollowUp` to the `end` event, which `Lantern` starts. Does
nothing while `offeredFollowUp` is `null`.

### `run.back(): Promise<void>`

Shows the previous step. Does nothing on the first step.

### `run.skip(): void`

Ends the tour as skipped. The state changes at once; the cleanup of the current step runs before
`end` fires.

### `run.interrupt(): void`

Ends the tour like `skip`, with the outcome `"interrupted"`. Unlike a skipped tour, an interrupted
one is not recorded as seen.

Calls made while an `enter` is still pending are queued, not dropped: two quick presses of Next move
two steps. Leaving a step, by any of these calls, aborts its signal and runs its cleanup before the
next step enters.

### `run.seek<TAnchor>(now: number, measure: TargetMeasure<TAnchor>): TargetFrame<TAnchor>`

Looks for the current step's target. The overlay calls it once per animation frame with the frame
time in milliseconds.

```ts
type TargetMeasure<TAnchor> = (found: Element | AnchorRect) => TAnchor | null;

type TargetFrame<TAnchor> =
  | { kind: "seeking" }
  | { kind: "centred" }
  | { kind: "anchored"; anchor: TAnchor };
```

`measure` turns what the target resolved to into an anchor, or returns `null` when it cannot be
lit, such as a detached or zero-sized element. A step without a target is `"centred"`. A target
that is not found stays `"seeking"` for one second from the first call, then `"centred"` with one
warning; it becomes `"anchored"` whenever it is found later. A target function that throws warns
and centres at once. Each step starts its own search, and the run is `"seeking"` until the first
step starts entering.

### `run.tour: Tour`

### `run.keys: TourKeys`

The [`lantern.keys`](Lantern.md#lanternkeys-tourkeys) of the lantern that started the run.

### `run.offeredFollowUp: Tour | null`

`tour.followUp` on a last step that waits for no action, `null` otherwise. The overlay shows its
button only while it is set.

### `run.index: number` and `run.step: TourStep`

The current step. While a step is entering, they already name it.

### `run.state: "running" | "finished" | "skipped" | "interrupted"`

### `run.waiting: boolean`

True when the current step has an `until` hook and waits for the user instead of Next.

### `run.first: boolean` and `run.last: boolean`

## Events

`TourRun` is an `@openally/emitt` `Emitter`. `on` returns the run; `subscribe` returns
a function that removes the listener.

### `step: (step: TourStep) => void`

Fires once the step's `enter` has settled and the step should show.

### `end: (outcome: "finished" | "skipped" | "interrupted", followUp: Tour | null) => void`

`followUp` is the tour to start next when the run ended through `startFollowUp`, and `null`
otherwise.
