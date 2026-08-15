// Import Internal Dependencies
import type { ColoredOutlinePass, ColoredOutlineEntry } from "../postprocess/ColoredOutlinePass.ts";
import type { PeerSelectionRegistry } from "./PeerSelectionRegistry.ts";
import type { SelectionManager } from "../SelectionManager.ts";

/**
 * The only surface of `ColoredOutlinePass` this class actually needs -
 * narrowed (rather than the concrete class) so a test can drive this class
 * with a lightweight spy instead of a real `ColoredOutlinePass`, which needs
 * a `THREE.WebGPURenderer`. A real `ColoredOutlinePass` instance satisfies
 * this trivially.
 */
export type ColoredOutlineTarget = Pick<ColoredOutlinePass, "setEntries">;

export interface PeerColoredOutlineOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  coloredOutline: ColoredOutlineTarget;
}

/**
 * Thin adapter wiring `PeerSelectionRegistry` + `SelectionManager` into a
 * `ColoredOutlinePass` - the many-peers, many-colors equivalent of
 * `PeerSelectionOverlays`, which instead builds one disposable per-object
 * mesh overlay per selected object (see its own doc comment for why that
 * doesn't hold up under many simultaneous selections).
 *
 * Rebuilds the *entire* entries list on any relevant change rather than
 * diffing it, since `ColoredOutlinePass.setEntries` is itself a full
 * replace - acceptable because selection changes are inherently low
 * frequency (click-driven), not something to assume holds for a
 * higher-frequency use (e.g. broadcasting live hover).
 *
 * Unlike `PeerSelectionOverlays` (which suppresses a peer's overlay for
 * whatever the local user has selected, since that older model renders the
 * local selection through a completely separate mechanism), the local
 * selection is included here as its own entry, in `selection.color` -
 * `ColoredOutlinePass` has no built-in notion of "mine" vs "theirs", so
 * there's nothing to suppress against, only a color to pick per object:
 * - An object selected only by peer(s) reads in the primary (oldest)
 *   selector's color - unchanged tie-break rule, see `PeerSelectionRegistry`.
 * - An object the local user has selected always reads in `selection.color`,
 *   even if one or more peers also have it selected - "my own selection
 *   wins visually for myself" takes priority over any peer's claim on the
 *   same object.
 * - The local selection's entry is also marked `priority: true` (see
 *   `ColoredOutlineEntry`'s own doc comment), so it stays visibly outlined
 *   even where a *different* object a peer has selected happens to overlap
 *   it on screen - without this, whichever of the two draws last during
 *   `ColoredOutlinePass`'s own scene traversal would silently win that
 *   overlap, regardless of which one actually matters to the local user.
 */
export class PeerColoredOutline {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #coloredOutline: ColoredOutlineTarget;

  #onPeerSelectionChange = (): void => this.refresh();
  #onLocalSelectionChange = (): void => this.refresh();

  constructor(
    options: PeerColoredOutlineOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#coloredOutline = options.coloredOutline;

    this.#registry.addEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#selection.addEventListener("selectionChange", this.#onLocalSelectionChange);

    this.refresh();
  }

  /**
   * Detaches its listeners. Does not touch `registry`/`selection` state, nor
   * dispose `coloredOutline` - only this class's own subscriptions, same
   * non-ownership convention as `PeerSelectionOverlays`.
   */
  dispose(): void {
    this.#registry.removeEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#selection.removeEventListener("selectionChange", this.#onLocalSelectionChange);
  }

  /**
   * Recomputes and pushes the full entries list from `registry`/`selection`'s
   * current state - called automatically on every `peerSelectionChange`/
   * `selectionChange`, but also exposed publicly for a caller that wraps
   * `coloredOutline` to inject extra entries of its own (e.g. a caller-level
   * bulk-selection concept this class has no notion of) and needs a way to
   * force a resync after changing state this class doesn't itself observe.
   */
  refresh(): void {
    const localSelected = this.#selection.selected;
    const objectIds = new Set(this.#registry.selectedObjectIds());
    if (localSelected !== null) {
      objectIds.add(localSelected);
    }

    const entries: ColoredOutlineEntry[] = [];

    for (const objectId of objectIds) {
      const target = this.#selection.targetFor(objectId);
      if (target === undefined) {
        continue;
      }

      if (objectId === localSelected) {
        entries.push({ target, color: this.#selection.color, priority: true });
        continue;
      }

      const peerId = this.#registry.primarySelectorOf(objectId);
      if (peerId === null) {
        continue;
      }

      entries.push({ target, color: this.#registry.colorOf(peerId) });
    }

    this.#coloredOutline.setEntries(entries);
  }
}
