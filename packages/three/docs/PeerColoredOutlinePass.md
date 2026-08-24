# PeerColoredOutlinePass

Thin adapter wiring [PeerSelectionRegistry](./PeerSelectionRegistry.md) +
[SelectionManager](./SelectionManager.md) into a
[ColoredOutlinePass](./ColoredOutlinePass.md) - the many-peers, many-colors
equivalent of [PeerSelectionOverlays](./PeerSelectionOverlays.md), which
instead builds one disposable per-object mesh overlay per selected object
(see that class's own doc comment for why that doesn't hold up under many
simultaneous selections). Works standalone too, with zero peers ever
registered - the local selection is included unconditionally (see below), so
this is a complete, self-sufficient "solo" `ColoredOutlinePass` driver, not
something that only makes sense once peers exist.

Rebuilds the *entire* entries list on any relevant change rather than diffing
it, since `ColoredOutlinePass.setEntries` is itself a full replace -
acceptable because selection changes are inherently low frequency
(click-driven), not something to assume holds for a higher-frequency use
(e.g. broadcasting live hover across peers).

Unlike `PeerSelectionOverlays` (which suppresses a peer's overlay for
whatever the local user has selected, since that older model renders the
local selection through a completely separate mechanism), the local
selection is included here as its own entry, in `selection.color` -
`ColoredOutlinePass` has no built-in notion of "mine" vs "theirs", so
there's nothing to suppress against, only a color to pick per object. An
object selected only by peer(s) reads in the primary (oldest) selector's
color, unchanged; an object the local user has selected always reads in
`selection.color`, even if one or more peers also have it selected - your
own selection wins visually for you, on top of anyone else's claim on the
same object. That entry is also marked `priority: true` (see
`ColoredOutlineEntry`'s own doc comment), so it stays visibly outlined even
where a *different* object a peer has selected happens to overlap it on
screen - without that, whichever of the two `ColoredOutlinePass` happened to
draw last would silently win the overlap.

The local *hover* (`selection.hovered`, when set and distinct from
`selection.selected`) is also included, in `selection.hoverColor`, but marked
`isolated: true`, not `priority` - a transient preview has no business
winning a silhouette overlap the way an actual selection does, but it also
shouldn't accidentally *cut* a peer's ring just because it happens to be
nearer the camera right now (see `ColoredOutlineEntry.isolated`'s own doc
comment). Deliberately simpler than the old per-object-overlay hover look (no
dimming): `ColoredOutlineEntry` has no opacity channel, and a
distinctly-colored, full-strength ring is the same visual language every
other entry here already uses.

A group (any non-mesh `SelectionManager` target) is pushed here exactly like
a mesh - `refresh` never special-cases it, and `ColoredOutlinePass` already
traverses a group entry to its own mesh descendants. This is intentionally
*on top of*, not instead of, the [SelectionBoundingBox](./SelectionBoundingBox.md)
`SelectionManager` still renders for that same group locally regardless of
technique - the box reads as "this is a group", the per-mesh colored outline
as "here's what's in it and whose selection color it's in". Both showing up
together for a group selection under the `"coloredOutline"` technique is by
design, not a redundancy to resolve by picking one.

```ts
import { SelectionManager, PeerSelectionRegistry, ColoredOutlinePass, PeerColoredOutlinePass } from "@jolly-pixel/three";

const selection = new SelectionManager();
const registry = new PeerSelectionRegistry();
const coloredOutline = new ColoredOutlinePass(renderer, scene, camera);
const peerColoredOutline = new PeerColoredOutlinePass({ registry, selection, coloredOutline });

selection.register("box-1", mesh);
registry.select("peer-a", "box-1"); // outlines mesh in peer-a's color
selection.select("box-1"); // now outlines it in selection.color instead - your own selection wins for you

// ... later
peerColoredOutline.dispose();
```

## PeerColoredOutlinePassOptions

```ts
export interface PeerColoredOutlinePassOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  coloredOutline: ColoredOutlineTarget; // the setEntries() surface of ColoredOutlinePass
  /**
   * Excludes a peer entry (same as if that peer hadn't selected anything)
   * for any object `visibility.isVisible` reports `false` for - e.g. outside
   * the camera frustum or beyond a configured max distance. Never consulted
   * for the local user's own selection/hover. Omitting this preserves
   * today's always-included behavior.
   */
  visibility?: PeerSelectionVisibility;
}
```

`coloredOutline` only needs to expose `setEntries` (`ColoredOutlineTarget =
Pick<ColoredOutlinePass, "setEntries">`) - a real `ColoredOutlinePass`
instance satisfies this trivially; the narrower type exists so a test can
drive this class with a lightweight spy instead of a real one (which needs a
`THREE.WebGPURenderer`).

## Methods

- `refresh(): void` - Recomputes and pushes the full entries list from `registry`/`selection`'s current state. Called automatically on every `peerSelectionChange`/`selectionChange`/`hoverChange`/(if `visibility` was given) `visibilityChange`, but also exposed publicly for a caller that wraps `coloredOutline` (see `ColoredOutlineTarget` above) to inject entries of its own - e.g. a caller-level bulk-selection concept this class has no notion of - and needs a way to force a resync after changing state this class doesn't itself observe.
- `dispose(): void` - Detaches its listeners. Does not touch `registry`/`selection`/`visibility` state, nor dispose `coloredOutline` - only this class's own subscriptions, same non-ownership convention as `PeerSelectionOverlays`.

## Notes

- Listens to `registry`'s `peerSelectionChange`, `selection`'s `selectionChange`/`hoverChange`, and (if `visibility` was given) `visibility`'s `visibilityChange` to know when to rebuild the entries list. See [PeerSelectionVisibility](./PeerSelectionVisibility.md) for what determines visibility.
- For every object with a current peer selector (`registry.selectedObjectIds()`) that the local user hasn't also selected or hovered, the color used is `registry.colorOf(registry.primarySelectorOf(id))` - the same "oldest selector wins" rule `PeerSelectionRegistry`/`PeerSelectionOverlays` already use, so this reads consistently with the rest of the peer-presence system regardless of which rendering technique is active. The local user's own current selection (`selection.selected`) is always included too, in `selection.color`, taking priority over any peer's claim on that same object; the local hover (`selection.hovered`), if distinct, is included next in `selection.hoverColor`.
- Unlike `PeerSelectionOverlays`, there's no `"coloredOutline"`-technique fallback to reason about: `ColoredOutlinePass` supports arbitrary simultaneous colors natively, so every `SelectionTechnique` reads the same way through this class.
- To layer in a caller-level concept this class doesn't know about (e.g. `examples/scripts/demo-stress.ts`'s "Random Selection" bulk-select, a demo-only stress mechanism with no equivalent in `SelectionManager`'s own single-selection API), wrap `coloredOutline` in a small object implementing `ColoredOutlineTarget` that appends the extra entries before forwarding to the real `setEntries`, pass that wrapper into `PeerColoredOutlinePassOptions.coloredOutline` instead of the real pass, and call `refresh()` whenever the caller-level state changes (nothing else will trigger a re-render of it, since this class only reacts to `registry`/`selection`'s own events).
- `test/selection/postprocess/PeerColoredOutlinePass.test.ts` exercises this wiring directly against a `PeerSelectionRegistry`/`SelectionManager` harness. `examples/scripts/demo-stress.ts`'s "Peer Colors" pane folder (run `npm run dev`, open `/stress.html`) drives `PeerSelectionRegistry` with synthetic peers but bypasses this class entirely (its own `refreshPeerColors` takes over the same job directly against `ColoredOutlinePass.setEntries` - see that function's own doc comment for why: an `InstancedMesh` instance has no whole `SelectableObject` for `SelectionManager.targetFor` to hand back). `examples/scripts/demo-selection.ts` and `examples/scripts/demo-peer-selection.ts` drive the real class instead.
