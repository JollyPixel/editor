# PeerColoredOutline

Thin adapter wiring [PeerSelectionRegistry](./PeerSelectionRegistry.md) +
[SelectionManager](./SelectionManager.md) into a
[ColoredOutlinePass](./ColoredOutlinePass.md) - the many-peers, many-colors
equivalent of [PeerSelectionOverlays](./PeerSelectionOverlays.md), which
instead builds one disposable per-object mesh overlay per selected object
(see that class's own doc comment for why that doesn't hold up under many
simultaneous selections).

Rebuilds the *entire* entries list on any relevant change rather than diffing
it, since `ColoredOutlinePass.setEntries` is itself a full replace -
acceptable because selection changes are inherently low frequency
(click-driven), not something to assume holds for a higher-frequency use
(e.g. broadcasting live hover).

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

```ts
import { SelectionManager, PeerSelectionRegistry, ColoredOutlinePass, PeerColoredOutline } from "@jolly-pixel/three";

const selection = new SelectionManager();
const registry = new PeerSelectionRegistry();
const coloredOutline = new ColoredOutlinePass(renderer, scene, camera);
const peerColoredOutline = new PeerColoredOutline({ registry, selection, coloredOutline });

selection.register("box-1", mesh);
registry.select("peer-a", "box-1"); // outlines mesh in peer-a's color
selection.select("box-1"); // now outlines it in selection.color instead - your own selection wins for you

// ... later
peerColoredOutline.dispose();
```

## PeerColoredOutlineOptions

```ts
export interface PeerColoredOutlineOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  coloredOutline: ColoredOutlineTarget; // the setEntries() surface of ColoredOutlinePass
}
```

`coloredOutline` only needs to expose `setEntries` (`ColoredOutlineTarget =
Pick<ColoredOutlinePass, "setEntries">`) - a real `ColoredOutlinePass`
instance satisfies this trivially; the narrower type exists so a test can
drive this class with a lightweight spy instead of a real one (which needs a
`THREE.WebGPURenderer`).

## Methods

- `refresh(): void` - Recomputes and pushes the full entries list from `registry`/`selection`'s current state. Called automatically on every `peerSelectionChange`/`selectionChange`, but also exposed publicly for a caller that wraps `coloredOutline` (see `ColoredOutlineTarget` above) to inject entries of its own - e.g. a caller-level bulk-selection concept this class has no notion of - and needs a way to force a resync after changing state this class doesn't itself observe.
- `dispose(): void` - Detaches its listeners. Does not touch `registry`/`selection` state, nor dispose `coloredOutline` - only this class's own subscriptions, same non-ownership convention as `PeerSelectionOverlays`.

## Notes

- Listens to both `registry`'s `peerSelectionChange` and `selection`'s `selectionChange` to know when to rebuild the entries list.
- For every object with a current peer selector (`registry.selectedObjectIds()`) that the local user hasn't also selected, the color used is `registry.colorOf(registry.primarySelectorOf(id))` - the same "oldest selector wins" rule `PeerSelectionRegistry`/`PeerSelectionOverlays` already use, so this reads consistently with the rest of the peer-presence system regardless of which rendering technique is active. The local user's own current selection (`selection.selected`) is always included too, in `selection.color`, taking priority over any peer's claim on that same object.
- Unlike `PeerSelectionOverlays`, there's no `"toonOutline"`-style fallback to reason about: `ColoredOutlinePass` supports arbitrary simultaneous colors natively, so every `MeshSelectionStyle` reads the same way through this class.
- To layer in a caller-level concept this class doesn't know about (e.g. `examples/scripts/demo-stress.ts`'s "Random Selection" bulk-select, a demo-only stress mechanism with no equivalent in `SelectionManager`'s own single-selection API), wrap `coloredOutline` in a small object implementing `ColoredOutlineTarget` that appends the extra entries before forwarding to the real `setEntries`, pass that wrapper into `PeerColoredOutlineOptions.coloredOutline` instead of the real pass, and call `refresh()` whenever the caller-level state changes (nothing else will trigger a re-render of it, since this class only reacts to `registry`/`selection`'s own events). See that demo for a working example.
- `test/selection/PeerColoredOutline.test.ts` exercises this wiring directly against a `PeerSelectionRegistry`/`SelectionManager` harness. `examples/scripts/demo-stress.ts`'s "Peer Colors" pane folder (run `npm run dev`, open `/stress.html`) drives the real `PeerSelectionRegistry`/`PeerColoredOutline` (not a bypass) with synthetic peers, alongside the local user's own click-selection and "Random Selection" bulk-select, all composited together.
