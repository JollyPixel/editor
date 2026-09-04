// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { HighlightPass, HighlightEntry } from "./HighlightPass.ts";
import type { PeerSelectionRegistry } from "../peer/PeerSelectionRegistry.ts";
import type { PeerHoverRegistry } from "../peer/PeerHoverRegistry.ts";
import type { PeerSelectionVisibility } from "../peer/PeerSelectionVisibility.ts";
import type { SelectionManager } from "../SelectionManager.ts";

// CONSTANTS
// How far a peer's hover entry color is mixed toward black, standing in
// for the opacity `PeerHoverOverlays` uses for the same "faded" look -
// `HighlightEntry` has no opacity channel, so darkening the color is the
// only way to distinguish a hover ring from a full-strength selection.
const kHoverDarkenFactor = 0.35;

/**
 * The only surface of `HighlightPass` this class needs - narrowed so a
 * test can drive it with a lightweight spy instead of a real
 * `HighlightPass`, which needs a `THREE.WebGPURenderer`. `HighlightPassJfa`
 * satisfies this too, letting a caller drive either technique
 * interchangeably.
 */
export type HighlightTarget = Pick<HighlightPass, "setEntries">;

export interface PeerHighlightPassOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  highlight: HighlightTarget;
  /**
   * Excludes a peer entry (same as if that peer hadn't selected anything)
   * for any object `visibility.isVisible` reports `false` for. Never
   * consulted for the local user's own selection/hover.
   */
  visibility?: PeerSelectionVisibility;
  /**
   * Feeds peer hover entries into the same `refresh()` this class already
   * runs for selection - see this class's own doc comment for the priority
   * rules. Optional; omitting it keeps today's behavior (no peer hover
   * entries).
   */
  hoverRegistry?: PeerHoverRegistry;
}

/**
 * Thin adapter wiring `PeerSelectionRegistry` + `SelectionManager` into a
 * `HighlightTarget` (a `HighlightPass` or `HighlightPassJfa`) - the
 * many-peers, many-colors equivalent of `PeerSelectionOverlays`, which
 * instead builds one disposable per-object overlay per selected object.
 * Works standalone too, with zero peers registered - the local selection
 * is included unconditionally, so this is a complete, self-sufficient
 * driver.
 *
 * Rebuilds the entire entries list on any relevant change rather than
 * diffing it, since `setEntries` is itself a full replace - fine because
 * selection changes are click-driven, not something to assume for a
 * higher-frequency use like live hover.
 *
 * Unlike `PeerSelectionOverlays`, the local selection is included here as
 * its own entry in `selection.color` - a `HighlightTarget` has no notion
 * of "mine" vs "theirs", only a color per object:
 * - An object selected only by peer(s) reads in the primary (oldest)
 *   selector's color.
 * - An object the local user has selected always reads in
 *   `selection.color`, even if a peer also has it selected.
 * - The local selection's entry is marked `priority: true` so it stays
 *   outlined even where a peer's selected object overlaps it on screen.
 * - The local hover (when distinct from the selection) is included in
 *   `selection.hoverColor`, marked `isolated: true` rather than
 *   `priority` - a transient preview shouldn't win a silhouette overlap,
 *   but also shouldn't cut a peer's ring just because it's nearer the
 *   camera right now.
 *
 * A remote peer's hover (when `hoverRegistry` is given) follows the same
 * three rules `PeerHoverOverlays` uses: any selector on the object (local
 * or peer) suppresses every hover entry for it; failing that, the local
 * hover always wins; failing both, the oldest peer hovering it wins. A
 * winning peer hover entry is `isolated: true`, colored by mixing toward
 * black (`kHoverDarkenFactor`) since `HighlightEntry` has no opacity
 * channel to dim through.
 *
 * A group (any non-mesh target) is pushed here exactly like a mesh; this
 * is intentionally on top of, not instead of, the `SelectionBoundingBox`
 * `SelectionManager` still renders for that group locally - the box reads
 * as "this is a group," the per-mesh highlight as "here's what's in it and
 * whose color it's in."
 */
export class PeerHighlightPass {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #highlight: HighlightTarget;
  #visibility: PeerSelectionVisibility | null;
  #hoverRegistry: PeerHoverRegistry | null;

  #onPeerSelectionChange = (): void => this.refresh();
  #onLocalSelectionChange = (): void => this.refresh();
  #onLocalHoverChange = (): void => this.refresh();
  #onVisibilityChange = (): void => this.refresh();
  #onPeerHoverChange = (): void => this.refresh();

  constructor(
    options: PeerHighlightPassOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#highlight = options.highlight;
    this.#visibility = options.visibility ?? null;
    this.#hoverRegistry = options.hoverRegistry ?? null;

    this.#registry.addEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#selection.addEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#selection.addEventListener("hoverChange", this.#onLocalHoverChange);
    this.#visibility?.addEventListener("visibilityChange", this.#onVisibilityChange);
    this.#hoverRegistry?.addEventListener("peerHoverChange", this.#onPeerHoverChange);

    this.refresh();
  }

  /**
   * Detaches its listeners. Does not touch `registry`/`selection`/
   * `visibility`/`hoverRegistry` state, nor dispose `highlight` - only this
   * class's own subscriptions, same non-ownership convention as
   * `PeerSelectionOverlays`.
   */
  dispose(): void {
    this.#registry.removeEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#selection.removeEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#selection.removeEventListener("hoverChange", this.#onLocalHoverChange);
    this.#visibility?.removeEventListener("visibilityChange", this.#onVisibilityChange);
    this.#hoverRegistry?.removeEventListener("peerHoverChange", this.#onPeerHoverChange);
  }

  /**
   * Recomputes and pushes the full entries list from `registry`/`selection`'s
   * current state - called automatically on every `peerSelectionChange`/
   * `selectionChange`/`hoverChange`, but also exposed publicly for a caller
   * that wraps `highlight` to inject extra entries of its own (e.g. a
   * caller-level bulk-selection concept this class has no notion of) and
   * needs a way to force a resync after changing state this class doesn't
   * itself observe.
   */
  refresh(): void {
    const localSelected = this.#selection.selected;
    const localHovered = this.#selection.hovered === localSelected ? null : this.#selection.hovered;

    const objectIds = new Set(this.#registry.selectedObjectIds());
    if (this.#hoverRegistry) {
      for (const objectId of this.#hoverRegistry.hoveredObjectIds()) {
        objectIds.add(objectId);
      }
    }
    if (localSelected !== null) {
      objectIds.add(localSelected);
    }
    if (localHovered !== null) {
      objectIds.add(localHovered);
    }

    const entries: HighlightEntry[] = [];

    for (const objectId of objectIds) {
      const target = this.#selection.targetFor(objectId);
      if (target === undefined) {
        continue;
      }

      if (objectId === localSelected) {
        entries.push({ target, color: this.#selection.color, priority: true });
        continue;
      }

      if (objectId === localHovered) {
        entries.push({ target, color: this.#selection.hoverColor, isolated: true });
        continue;
      }

      // `visibility` only ever gates a peer entry, never the local
      // selection/hover branches above - see this option's own doc comment.
      const visible = this.#visibility === null || this.#visibility.isVisible(objectId);

      const peerId = visible ? this.#registry.primarySelectorOf(objectId) : null;
      if (peerId !== null) {
        entries.push({ target, color: this.#registry.colorOf(peerId) });
        continue;
      }

      // A selector (checked above, regardless of `visible`) always
      // suppresses hover for this object - rule 1. Reaching here means
      // there was none, so a peer hover is eligible.
      if (this.#registry.selectorsOf(objectId).length > 0 || !visible || this.#hoverRegistry === null) {
        continue;
      }

      const hovererId = this.#hoverRegistry.primaryHovererOf(objectId);
      if (hovererId === null) {
        continue;
      }

      entries.push({ target, color: this.#darken(this.#hoverRegistry.colorOf(hovererId)), isolated: true });
    }

    this.#highlight.setEntries(entries);
  }

  /**
   * Mixes `color` toward black by `kHoverDarkenFactor`. Always returns a
   * fresh `THREE.Color` - `HighlightPass.setEntries` converts each entry's
   * color only once the whole array is handed to it, so a shared mutable
   * scratch instance here would have every entry read whatever the last
   * call left behind.
   */
  #darken(
    color: THREE.ColorRepresentation
  ): THREE.Color {
    return new THREE.Color(color).lerp(new THREE.Color(0x000000), kHoverDarkenFactor);
  }
}
