// Import Internal Dependencies
import type { ColoredOutlinePass, ColoredOutlineEntry } from "./ColoredOutlinePass.ts";
import type { PeerSelectionRegistry } from "../peer/PeerSelectionRegistry.ts";
import type { PeerSelectionVisibility } from "../peer/PeerSelectionVisibility.ts";
import type { SelectionManager } from "../SelectionManager.ts";

/**
 * The only surface of `ColoredOutlinePass` this class actually needs -
 * narrowed (rather than the concrete class) so a test can drive this class
 * with a lightweight spy instead of a real `ColoredOutlinePass`, which needs
 * a `THREE.WebGPURenderer`. A real `ColoredOutlinePass` instance satisfies
 * this trivially.
 */
export type ColoredOutlineTarget = Pick<ColoredOutlinePass, "setEntries">;

export interface PeerColoredOutlinePassOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  coloredOutline: ColoredOutlineTarget;
  /**
   * Excludes a peer entry (same as if that peer hadn't selected anything)
   * for any object `visibility.isVisible` reports `false` for - e.g. outside
   * the camera frustum or beyond a configured max distance. Never consulted
   * for the local user's own selection/hover. Omitting this preserves
   * today's always-included behavior.
   */
  visibility?: PeerSelectionVisibility;
}

/**
 * Thin adapter wiring `PeerSelectionRegistry` + `SelectionManager` into a
 * `ColoredOutlinePass` - the many-peers, many-colors equivalent of
 * `PeerSelectionOverlays`, which instead builds one disposable per-object
 * mesh overlay per selected object (see its own doc comment for why that
 * doesn't hold up under many simultaneous selections). Works standalone too,
 * with zero peers ever registered - the local selection is included
 * unconditionally (see below), so this is a complete, self-sufficient
 * "solo" `ColoredOutlinePass` driver, not something that only makes sense
 * once peers exist.
 *
 * Rebuilds the *entire* entries list on any relevant change rather than
 * diffing it, since `ColoredOutlinePass.setEntries` is itself a full
 * replace - acceptable because selection changes are inherently low
 * frequency (click-driven), not something to assume holds for a
 * higher-frequency use (e.g. broadcasting live hover across peers).
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
 * - The local *hover* (`selection.hovered`, when set and distinct from
 *   `selection.selected`) is also included, in `selection.hoverColor`, but
 *   marked `isolated: true`, not `priority` - a transient preview has no
 *   business winning a silhouette overlap the way an actual selection does,
 *   but it also shouldn't accidentally *cut* a peer's ring just because it
 *   happens to be nearer the camera right now (the ordinary depth-tested
 *   overlap every non-priority, non-isolated entry is otherwise subject to -
 *   see `ColoredOutlineEntry.isolated`'s own doc comment for why that needed
 *   its own mechanism, distinct from `priority`). Deliberately simpler than
 *   the old per-object-overlay hover look (no dimming): `ColoredOutlineEntry`
 *   has no opacity channel, and a distinctly-colored, full-strength ring is
 *   the same visual language every other entry here already uses - adding a
 *   dedicated dimming channel for just this one role isn't worth the extra
 *   shader plumbing.
 *
 * A group (any non-mesh `SelectionManager` target) is pushed here exactly
 * like a mesh - `refresh` never special-cases it, and `ColoredOutlinePass`
 * already traverses a group entry to its own mesh descendants (see its own
 * `setEntries` doc comment). This is intentionally on top of, not instead
 * of, the `SelectionBoundingBox` `SelectionManager` still renders for that
 * same group locally regardless of technique - the box reads as "this is a
 * group", the per-mesh colored outline as "here's what's in it and whose
 * selection color it's in". Both showing up together for a group selection
 * under the `"coloredOutline"` technique is by design, not a redundancy to
 * resolve by picking one.
 */
export class PeerColoredOutlinePass {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #coloredOutline: ColoredOutlineTarget;
  #visibility: PeerSelectionVisibility | null;

  #onPeerSelectionChange = (): void => this.refresh();
  #onLocalSelectionChange = (): void => this.refresh();
  #onLocalHoverChange = (): void => this.refresh();
  #onVisibilityChange = (): void => this.refresh();

  constructor(
    options: PeerColoredOutlinePassOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#coloredOutline = options.coloredOutline;
    this.#visibility = options.visibility ?? null;

    this.#registry.addEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#selection.addEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#selection.addEventListener("hoverChange", this.#onLocalHoverChange);
    this.#visibility?.addEventListener("visibilityChange", this.#onVisibilityChange);

    this.refresh();
  }

  /**
   * Detaches its listeners. Does not touch `registry`/`selection`/`visibility`
   * state, nor dispose `coloredOutline` - only this class's own
   * subscriptions, same non-ownership convention as `PeerSelectionOverlays`.
   */
  dispose(): void {
    this.#registry.removeEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#selection.removeEventListener("selectionChange", this.#onLocalSelectionChange);
    this.#selection.removeEventListener("hoverChange", this.#onLocalHoverChange);
    this.#visibility?.removeEventListener("visibilityChange", this.#onVisibilityChange);
  }

  /**
   * Recomputes and pushes the full entries list from `registry`/`selection`'s
   * current state - called automatically on every `peerSelectionChange`/
   * `selectionChange`/`hoverChange`, but also exposed publicly for a caller
   * that wraps `coloredOutline` to inject extra entries of its own (e.g. a
   * caller-level bulk-selection concept this class has no notion of) and
   * needs a way to force a resync after changing state this class doesn't
   * itself observe.
   */
  refresh(): void {
    const localSelected = this.#selection.selected;
    const localHovered = this.#selection.hovered === localSelected ? null : this.#selection.hovered;

    const objectIds = new Set(this.#registry.selectedObjectIds());
    if (localSelected !== null) {
      objectIds.add(localSelected);
    }
    if (localHovered !== null) {
      objectIds.add(localHovered);
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

      if (objectId === localHovered) {
        entries.push({ target, color: this.#selection.hoverColor, isolated: true });
        continue;
      }

      // `visibility` only ever gates a peer entry, never the local
      // selection/hover branches above - see this option's own doc comment.
      if (this.#visibility !== null && !this.#visibility.isVisible(objectId)) {
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
