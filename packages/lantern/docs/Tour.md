# Tour

A `Tour` is the declaration of a guided tour: an id, a version, a title and its steps. The
constructor checks the declaration and throws a `TourDefinitionError` on the first broken field,
so a typo fails the editor's unit test instead of a newcomer's first visit.

```ts
import { Tour } from "@jolly-pixel/lantern";
import placeBlockUrl from "./images/place-block.webp";

export const basics = new Tour({
  id: "voxel-map.basics",
  version: 1,
  title: "Voxel map basics",
  steps: [
    {
      id: "blocks",
      target: ["jolly-pane[key=blocks]"],
      title: "Blocks",
      body: "Pick the block you want to place here.",
      image: { src: placeBlockUrl, alt: "A block placed on the grid" },
      side: "right"
    }
  ]
});
```

## Tour

### `new Tour(options: TourOptions)`

- `id`: a dotted identifier such as `voxel-map.basics`, unique on the page. It is also the key
  under which [`LanternSeen`](./Lantern.md#lanternseen) stores the seen state.
- `version`: a positive integer. Raising it makes the tour unseen again, so a reworked tour reaches
  people who skipped the old one.
- `title`: shown in the card header, the toolbar menu and `/tour.list`.
- `steps`: at least one `TourStepOptions`. Step ids are unique inside the tour.
- `followUp`: optional `Tour` to offer on the last step. It does not have to be registered.

### `tour.followUp: Tour | null`

### `tour.steps: readonly TourStep[]`

The parsed steps, frozen. Defaults are filled in: `side` is `"below"`, and `image`, `target`,
`enter` and `until` are `null` when omitted. A selector list becomes a `TargetPath`.

### `tour.stepIndex(stepId: string): number`

The position of a step, or `-1`. A `Tour` is also iterable over its steps.

## Steps

### `id: string`

Stable name, used by `start(tour, { at })` and in warnings.

### `title: string` and `body: string`

The card heading and text. The body is plain text: a blank line starts a paragraph, and a
`` `backtick` `` span renders as `<kbd>`.

A `` `{namespace.action}` `` span names a binding instead of a key. The card shows the first key
the user has bound to it, read from [`lantern.keys`](Lantern.md#lanternkeys-tourkeys) each time the
step renders. An action with no key shows "unbound", and a namespace nobody provides keeps the span
as written.

```ts
body: "`{camera.forward}` `{camera.left}` `{camera.back}` `{camera.right}` fly."
```

### `image?: { src, alt, width?, height? }`

A picture above the text. `src` is a URL, so a Vite asset import works. A looping WebP or GIF covers
short demonstrations.

### `target?: string[] | (() => Element | AnchorRect | null)`

What the spotlight surrounds. Without a target the card is centred and nothing is lit.

A selector list becomes a [`TargetPath`](#targetpath) in the parsed step. A function covers what a selector cannot
express: it returns an element, an `AnchorRect` in viewport pixels (the area around a projected
world position in a 3D viewport, for example), or `null`.

When the target resolves to `null`, the overlay retries every frame for one second, then centres
the card and warns with the tour and step ids. It keeps resolving afterwards, so a target that
shows up late is still lit.

### `side?: "above" | "below" | "left" | "right"`

Preferred side of the card. It flips to the opposite side when it does not fit there.

### `enter?: (context) => void | (() => void) | Promise<…>`

Runs before the step shows, to make its target visible: show a pane, open a folder, select a
tool. It may return a cleanup that runs when the step is left, by any means. The cleanup should
put back what the user had: a step that switches to another tab should switch back to the tab
that was active, so leaving the tour returns the user to where they started.

`context` is `{ page: Document, signal: AbortSignal }`. The signal aborts when the step is left,
including on a skip while `enter` is still pending. An `enter` that throws is logged and the step
shows anyway.

### `until?: (context) => Promise<void>`

Makes the step interactive: "Place a block", "Orbit the camera".

```ts
{
  id: "place",
  target: () => editor.viewportRect(),
  title: "Place a block",
  body: "Click anywhere on the grid.",
  until: ({ signal }) => editor.once("block-placed", { signal })
}
```

The step advances when the promise resolves. A rejection is logged and also advances, so a broken
hook cannot trap the user. Leaving the step aborts `signal`, and the listener must stop on abort.
See the [element](./element.md#interactive-steps) for what changes on screen.

## TargetPath

An array of selectors. The first runs against the document; each following one runs inside the
shadow root of the previous match, or inside the match itself when it has no shadow root.
`["jolly-editor-toolbar", "[data-tour=save]"]` reads as "the save button inside the toolbar".

Prefer attributes the page already has, such as `jolly-pane[key=blocks]`. Where nothing stable
exists, add a `data-tour` attribute: class names and DOM position change with styling work.

### `new TargetPath(selectors: Iterable<string>)`

### `path.resolve(root?: ParentNode): Element | null`

Walks the selectors from `root` (default `document`). An editor test can resolve every path of its
tours against the real markup:

```ts
for (const step of basics) {
  if (step.target instanceof TargetPath) {
    assert.ok(step.target.resolve(document), `${step.id} resolves`);
  }
}
```

### `path.selectors: readonly string[]`

A `TargetPath` is also iterable over its selectors.

## Errors

### `TourDefinitionError`

Thrown by `new Tour()`. `tourId` and `field` name the broken part, for example `steps[2].target`,
or `steps[2].target[1]` for a blank selector.

### `UnknownStepError`

Thrown when `at` names no step of the tour. Carries `tourId` and `stepId`.

### `UnknownTourError`

Thrown by `lantern.tour(id)` when no registered tour has the id. Carries `tourId`.
