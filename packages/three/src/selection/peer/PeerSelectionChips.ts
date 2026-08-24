// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { computeLocalBoundingBox } from "../overlays/computeLocalBoundingBox.ts";
import { PeerSelectionChip, type PeerSelectionChipOptions } from "./PeerSelectionChip.ts";
import type { PeerSelectionRegistry, PeerSelectionChangeEventDetail } from "./PeerSelectionRegistry.ts";
import type { PeerSelectionVisibility } from "./PeerSelectionVisibility.ts";
import type { SelectionManager } from "../SelectionManager.ts";

// CONSTANTS
const kChipSpacing = 0.4;
const kChipMarginY = 0.35;
/**
 * Caps how many individual per-selector chips a row ever shows - beyond
 * this, the rest collapse into one "+N" overflow badge (see `#buildSlots`)
 * instead of the row growing without bound. Unlike `ColoredOutlinePass`
 * (cost scales with distinct outlined *objects*, not peers), each chip is
 * its own draw call and its own GPU-resident canvas texture with no
 * batching between them - fine for the handful of concurrent selectors a
 * real collaborative editing session actually has, not something to leave
 * unbounded against however many peers happen to pile onto one object.
 */
const kMaxChips = 3;
/**
 * Neutral, not tied to any peer's own color, so the overflow badge never
 * gets mistaken for a real selector.
 */
const kOverflowChipColor = "#4a4a4a";

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
   * chip is its own draw call and its own GPU-resident canvas texture (see
   * `kMaxChips`'s own doc comment), so a caller wiring this class in for the
   * first time doesn't get it live until deciding to. Toggle at runtime via
   * `setEnabled`.
   * @default false
   */
  enabled?: boolean;
}

/**
 * One small row of colored billboard chips - see `PeerSelectionChip`'s own
 * doc comment - floating above any object with *more than one* simultaneous
 * peer selector, oldest-first (`registry.selectorsOf`'s own order), capped
 * at `kMaxChips` individual chips with the rest collapsed into a trailing
 * "+N" overflow badge (see `#buildSlots`) rather than the row growing
 * without bound. An object with zero or one selector gets no chip row at
 * all: the primary ring `PeerSelectionOverlays`/`PeerColoredOutlinePass`
 * already draws communicates a single selector's color on its own, so a
 * one-chip row would be pure redundancy.
 *
 * Off by default (`enabled: false`, see `PeerSelectionChipsOptions.enabled`)
 * - a caller opts in explicitly, either at construction or later via
 * `setEnabled`.
 *
 * A third, independent rendering concern from the primary ring - this class
 * has no notion of which technique is currently drawing that ring, or
 * whether it's `PeerSelectionOverlays` or `PeerColoredOutlinePass` driving
 * it. Never gated by the local selection: the same object can show a local
 * selection ring *and* a peer chip row at once, since the chip row is only
 * ever about `registry.selectorsOf`, a purely peer-side concern the local
 * selection doesn't affect (the same reasoning
 * `examples/scripts/demo-selection.ts`'s own pre-existing DOM-based
 * `refreshChips` outliner chips already follow - they too only react to
 * `peerSelectionChange`, never a local `selectionChange`).
 */
export class PeerSelectionChips {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #visibility: PeerSelectionVisibility | null;
  #enabled: boolean;
  #groups = new Map<string, THREE.Group>();

  #onPeerSelectionChange: (event: Event) => void;
  #onVisibilityChange: () => void;

  constructor(
    options: PeerSelectionChipsOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#visibility = options.visibility ?? null;
    this.#enabled = options.enabled ?? false;

    this.#onPeerSelectionChange = (event) => {
      const { objectId, previousObjectId } = (event as CustomEvent<PeerSelectionChangeEventDetail>).detail;

      if (previousObjectId !== null) {
        this.#refresh(previousObjectId);
      }
      if (objectId !== null) {
        this.#refresh(objectId);
      }
    };

    this.#onVisibilityChange = () => {
      for (const objectId of this.#registry.selectedObjectIds()) {
        this.#refresh(objectId);
      }
    };

    this.#registry.addEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#visibility?.addEventListener("visibilityChange", this.#onVisibilityChange);
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  /**
   * Toggles chip rows on/off at runtime. Turning it off immediately disposes
   * every currently active chip row; turning it on immediately builds one
   * for every currently-qualifying peer-selected object (same as if this
   * class had just been constructed with `enabled: true` and every existing
   * `peerSelectionChange` had already fired) - not a lazy "wait for the next
   * event" flip. A no-op if `enabled` already matches the current state.
   */
  setEnabled(
    enabled: boolean
  ): void {
    if (this.#enabled === enabled) {
      return;
    }
    this.#enabled = enabled;

    if (!enabled) {
      for (const group of this.#groups.values()) {
        this.#disposeGroup(group);
      }
      this.#groups.clear();

      return;
    }

    for (const objectId of this.#registry.selectedObjectIds()) {
      this.#refresh(objectId);
    }
  }

  /**
   * Detaches its listeners and disposes every active chip row. Does not
   * touch `registry`/`selection`/`visibility` state - only this class's own
   * render output.
   */
  dispose(): void {
    this.#registry.removeEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#visibility?.removeEventListener("visibilityChange", this.#onVisibilityChange);

    for (const group of this.#groups.values()) {
      this.#disposeGroup(group);
    }
    this.#groups.clear();
  }

  #refresh(
    objectId: string
  ): void {
    const selectors = this.#registry.selectorsOf(objectId);
    const visible = this.#visibility === null || this.#visibility.isVisible(objectId);
    const existing = this.#groups.get(objectId);

    if (!this.#enabled || selectors.length <= 1 || !visible) {
      if (existing) {
        this.#disposeGroup(existing);
        this.#groups.delete(objectId);
      }

      return;
    }

    const slots = this.#buildSlots(selectors);

    if (existing && existing.children.length === slots.length) {
      slots.forEach((slot, index) => {
        const chip = existing.children[index] as PeerSelectionChip;
        chip.color = slot.color;
        chip.label = slot.label;
      });

      return;
    }

    if (existing) {
      this.#disposeGroup(existing);
      this.#groups.delete(objectId);
    }

    const target = this.#selection.targetFor(objectId);
    if (!target) {
      return;
    }

    const box = computeLocalBoundingBox(target);
    if (box.isEmpty()) {
      return;
    }

    const center = box.getCenter(new THREE.Vector3());
    const group = new THREE.Group();
    group.position.set(center.x, box.max.y + kChipMarginY, center.z);

    slots.forEach((slot, index) => {
      const chip = new PeerSelectionChip(slot);
      chip.position.x = (index - (slots.length - 1) / 2) * kChipSpacing;
      group.add(chip);
    });

    target.add(group);
    this.#groups.set(objectId, group);
  }

  /**
   * One slot per selector, oldest-first, up to `kMaxChips` - beyond that,
   * the remaining selectors collapse into a single trailing overflow slot
   * (`color: kOverflowChipColor`, `label: "+N"`) instead of the row growing
   * per selector without bound. `selectors.length` is always `> 1` by the
   * time this is called (see the caller's own early return), so this always
   * returns at least 2 slots.
   */
  #buildSlots(
    selectors: readonly string[]
  ): PeerSelectionChipOptions[] {
    if (selectors.length <= kMaxChips) {
      return selectors.map((peerId) => {
        return { color: this.#registry.colorOf(peerId) };
      });
    }

    const slots: PeerSelectionChipOptions[] = selectors.slice(0, kMaxChips).map((peerId) => {
      return { color: this.#registry.colorOf(peerId) };
    });
    slots.push({ color: kOverflowChipColor, label: `+${selectors.length - kMaxChips}` });

    return slots;
  }

  #disposeGroup(
    group: THREE.Group
  ): void {
    group.removeFromParent();
    for (const child of group.children) {
      (child as PeerSelectionChip).dispose();
    }
  }
}
