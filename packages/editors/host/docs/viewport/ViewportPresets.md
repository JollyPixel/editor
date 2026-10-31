# Viewport presets

Values the editors share so their viewports look and behave alike. The
`viewport` entry loads no UI, so a unit test can import it without a DOM.

```ts
import {
  EDITOR_GIZMO_APPEARANCE,
  bindOrbitFocus,
  presenceColorAllocator
} from "@jolly-pixel/editor.host/viewport";
```

## bindOrbitFocus(camera, options): () => void

Gives an `OrbitFlyCamera` the editors' pivot behavior: Escape leaves the pivot
(and passes on while the camera flies freely), and each switch between pivot and
free fly is pushed to `options.log`. Returns the function that releases both.

```ts
teardown.defer(bindOrbitFocus(camera, {
  keyboard: world.input.keyboard,
  log
}));
```

## EDITOR_GIZMO_APPEARANCE

The `TransformControls` appearance of every editor: a small gizmo with an
interactive center, inset planes, handles flipped toward the camera and a dark
outline. Spread it to override a field.

```ts
new TransformControls(camera, canvas, {
  appearance: {
    ...EDITOR_GIZMO_APPEARANCE,
    viewRing: false
  }
});
```

## presenceColorAllocator(peers): PeerColorAllocator

Colors each peer highlight with the peer's presence color, read from `peers()`
on every lookup. A client missing from the list gets `#ffffff`.

```ts
new PeerHighlights({
  colorAllocator: presenceColorAllocator(() => presence.peers)
});
```
