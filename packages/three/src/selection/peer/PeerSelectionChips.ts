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
 * Caps how many individual per-selector chips a row shows - beyond this,
 * the rest collapse into one "+N" overflow badge (see `#buildSlots`). Each
 * chip is its own draw call and GPU-resident canvas texture with no
 * batching, so this stays small rather than scaling with however many
 * peers pile onto one object.
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
   * reports `false` for - same semantics as
   * `PeerSelectionOverlays`/`PeerHighlightPass`'s own `visibility`.
   */
  visibility?: PeerSelectionVisibility;
  /**
   * Whether chip rows render at all. Opt-in since each chip is its own draw
   * call and GPU-resident canvas texture (see `kMaxChips`). Toggle at
   * runtime via `setEnabled`.
   * @default false
   */
  enabled?: boolean;
}

/**
 * One small row of colored billboard chips (see `PeerSelectionChip`)
 * floating above any object with *more than one* simultaneous peer
 * selector, oldest-first, capped at `kMaxChips` with the rest collapsed
 * into a trailing "+N" overflow badge. An object with zero or one selector
 * gets no chip row - the primary ring already communicates a single
 * selector's color on its own.
 *
 * Off by default (see `PeerSelectionChipsOptions.enabled`) - a caller opts
 * in explicitly, at construction or later via `setEnabled`.
 *
 * Independent of the primary ring's technique or which class draws it.
 * Never gated by the local selection - the chip row is purely about
 * `registry.selectorsOf`, so the same object can show a local selection
 * ring and a peer chip row at once.
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
   * Toggles chip rows on/off at runtime. Turning off immediately disposes
   * every active row; turning on immediately builds one for every
   * qualifying object, not a lazy "wait for the next event" flip. A no-op
   * if `enabled` already matches.
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
        const chip = existing.children[index];
        if (!(chip instanceof PeerSelectionChip)) {
          return;
        }
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
   * the rest collapse into a single trailing overflow slot. Always returns
   * at least 2 slots (the caller only reaches here when
   * `selectors.length > 1`).
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
      if (child instanceof PeerSelectionChip) {
        child.dispose();
      }
    }
  }
}
