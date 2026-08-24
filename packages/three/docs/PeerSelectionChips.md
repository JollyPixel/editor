# PeerSelectionChips

A small row of colored billboard chips - see `PeerSelectionChip` below - floating above any object with
*more than one* simultaneous peer selector, oldest-first (matching [PeerSelectionRegistry](./PeerSelectionRegistry.md)'s
own `selectorsOf` order). An object with zero or one selector gets no chip row at all: the primary ring
[PeerSelectionOverlays](./PeerSelectionOverlays.md)/[PeerColoredOutlinePass](./PeerColoredOutlinePass.md)
already draws communicates a single selector's color on its own, so a one-chip row would be pure redundancy.

Capped at 3 individual chips - a 4th+ selector collapses the rest into one trailing gray "+N" overflow badge
instead of the row growing without bound. Unlike `ColoredOutlinePass` (cost scales with distinct outlined
*objects*, not peers), each chip is its own draw call and its own GPU-resident canvas texture with no batching
between them - fine for the handful of concurrent selectors a real collaborative editing session actually
has, not something left unbounded against however many peers happen to pile onto one object.

A third, independent rendering concern from the primary ring - this class has no notion of which technique
is currently drawing that ring, or whether it's `PeerSelectionOverlays` or `PeerColoredOutlinePass` driving
it. Never gated by the local selection: the same object can show a local-selection ring *and* a peer chip
row at once, since the chip row is only ever about `registry.selectorsOf`, a purely peer-side concern the
local selection doesn't affect.

Off by default (`enabled: false`) - each chip is its own draw call and its own GPU-resident canvas texture
with no batching between them (see `PeerSelectionChipsOptions.enabled`'s own doc comment), so a caller wiring
this class in doesn't pay for it until opting in, either at construction or later via `setEnabled`.

```ts
import { SelectionManager, PeerSelectionRegistry, PeerSelectionChips } from "@jolly-pixel/three";

const selection = new SelectionManager();
const registry = new PeerSelectionRegistry();
const chips = new PeerSelectionChips({ registry, selection, enabled: true });

selection.register("sphere-1", mesh);
registry.select("Alice", "sphere-1");
registry.select("Bob", "sphere-1"); // now shows two chips, Alice's color then Bob's

// ... later
chips.dispose();
```

## PeerSelectionChipsOptions

```ts
export interface PeerSelectionChipsOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  /**
   * Skips the chip row entirely for any object `visibility.isVisible`
   * reports `false` for - same option, same semantics, as
   * `PeerSelectionOverlays`/`PeerColoredOutlinePass`'s own `visibility`.
   * Omitting this preserves always-visible behavior.
   */
  visibility?: PeerSelectionVisibility;
  /**
   * Whether chip rows render at all. Defaults `false` - opt-in, since each
   * chip is its own draw call and its own GPU-resident canvas texture, so a
   * caller wiring this class in for the first time doesn't get it live
   * until deciding to. Toggle at runtime via `setEnabled`.
   * @default false
   */
  enabled?: boolean;
}
```

## Methods

- `get enabled(): boolean` - Current enabled state.
- `setEnabled(enabled: boolean): void` - Toggles chip rows on/off at runtime. Turning it off immediately disposes every currently active chip row; turning it on immediately builds one for every currently-qualifying peer-selected object - not a lazy "wait for the next event" flip. A no-op if `enabled` already matches the current state.
- `dispose(): void` - Detaches its listeners and disposes every active chip row. Does not touch `registry`/`selection`/`visibility` state - only this class's own render output.

## Notes

- Listens to `registry`'s `peerSelectionChange` and (if `visibility` was given) `visibility`'s `visibilityChange` - deliberately **not** `selection`'s `selectionChange`, unlike `PeerSelectionOverlays`. The chip row is purely a function of `registry.selectorsOf(objectId).length`; the local selection neither suppresses nor otherwise affects it, so there's nothing for a `selectionChange` listener to do here.
- Position is computed once, when a chip row is first built, via `computeLocalBoundingBox(target)` (see [SelectionBoundingBox](./SelectionBoundingBox.md)'s own Notes for where that function lives) - centered above the target's own local bounding box top. Not re-tracked automatically if the target's geometry/hierarchy changes afterward - same "call `update()` yourself" limitation `SelectionBoundingBox`/`SelectionOutline` already have, except this class exposes no public `update()` to force it (a chip row is rebuilt wholesale on the next real selector-count change anyway).
- Reuses existing `PeerSelectionChip` instances (recolors/relabels them in place) when a re-refresh finds the *same* number of *slots* as before - rebuilds (dispose + recreate) whenever the slot count itself changes. "Slots", not raw selector count: going from 4 to 5 selectors is still 3 chips + 1 overflow badge (same slot count, just the badge's own label changing from "+1" to "+2"), so that case also recolors/relabels in place rather than rebuilding. In practice, `PeerSelectionRegistry.select` always changes one object's own selector count by exactly ±1 per call, so a same-slot-count re-refresh only actually happens via a `visibilityChange` sweep touching an *unrelated* object (see `PeerSelectionVisibility`'s own doc comment on why that sweep re-checks every currently peer-selected id, not just the one that changed) - not from peer join/leave directly.
- See `examples/scripts/demo-peer-selection.ts` (run `npm run dev`, open `/peer-selection.html`) - "Shared Sphere" (Alice + Bob) is the one preset object with more than one selector, so it's the only one that shows a chip row.

## PeerSelectionChip

```ts
export interface PeerSelectionChipOptions {
  color: THREE.ColorRepresentation;
  /**
   * Short text (e.g. "+3") drawn centered on the chip instead of it being a
   * plain filled circle - `PeerSelectionChips`' own overflow badge uses
   * this; a plain per-selector chip omits it.
   */
  label?: string;
}
```

`PeerSelectionChip` is the exported sprite `PeerSelectionChips` builds one of per selector (or one overflow
badge summarizing several, via `label`); most consumers manage it through the owning chip row, but it can also
be constructed directly. Mirrors [PeerFrustum](./PeerFrustum.md)'s own `PeerFrustumLabel` shape (`THREE.Sprite`
+ a canvas-texture billboard), just simpler: usually a small filled, dark-stroked circle in `color` with no
text - `label` is the one exception, not a general nameplate (`PeerSelectionRegistry` never guarantees a
display name for a bare peer id the way `network.PeerMetadata` does for `PeerFrustumSync`, so keep it short).

### Properties

- `color: THREE.ColorRepresentation` - get/set. Setting it redraws the chip's own canvas texture.
- `label: string | undefined` - get/set. Setting it redraws the chip's own canvas texture with the new text centered on it (or clears it back to a plain colored circle when set to `undefined`).

### Methods

- `dispose(): void` - Disposes the canvas texture and sprite material.
