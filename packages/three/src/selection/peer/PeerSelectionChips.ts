// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { computeLocalBoundingBox } from "../overlays/computeLocalBoundingBox.ts";
import {
  PeerSelectionChip,
  type PeerSelectionChipOptions
} from "./PeerSelectionChip.ts";
import type {
  PeerSelectionRegistry,
  PeerSelectionChangeEventDetail
} from "./PeerSelectionRegistry.ts";
import type { PeerSelectionVisibility } from "./PeerSelectionVisibility.ts";
import type {
  SelectionManager,
  SelectionManagerChangeEventDetail
} from "../SelectionManager.ts";

// CONSTANTS
const kChipSpacing = 0.4;
const kChipMarginY = 0.35;
const kMaxChips = 3;
const kOverflowChipColor = "#4a4a4a";

export interface PeerSelectionChipsOptions {
  registry: PeerSelectionRegistry;
  selection: SelectionManager;
  /**
   * Suppresses chip rows for objects reported as invisible.
   */
  visibility?: PeerSelectionVisibility;
  /**
   * Enables chip rows.
   * @default false
   */
  enabled?: boolean;
}

export class PeerSelectionChips {
  #registry: PeerSelectionRegistry;
  #selection: SelectionManager;
  #visibility: PeerSelectionVisibility | null;
  #enabled: boolean;
  #groups = new Map<string, THREE.Group>();

  #onPeerSelectionChange: (event: CustomEvent<PeerSelectionChangeEventDetail>) => void;
  #onVisibilityChange: () => void;
  #onTargetsChange: (
    event: CustomEvent<SelectionManagerChangeEventDetail>
  ) => void;
  #onSelectionDispose: () => void;

  constructor(
    options: PeerSelectionChipsOptions
  ) {
    this.#registry = options.registry;
    this.#selection = options.selection;
    this.#visibility = options.visibility ?? null;
    this.#enabled = options.enabled ?? false;

    this.#onPeerSelectionChange = (event) => {
      const { objectId, previousObjectId } = event.detail;

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
    this.#onTargetsChange = (event) => {
      for (const objectId of event.detail.objectIds) {
        const existing = this.#groups.get(objectId);
        if (existing) {
          this.#disposeGroup(existing);
          this.#groups.delete(objectId);
        }
        this.#refresh(objectId);
      }
    };
    this.#onSelectionDispose = () => this.dispose();

    this.#registry.addEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#visibility?.addEventListener("visibilityChange", this.#onVisibilityChange);
    this.#selection.addEventListener("targetsChange", this.#onTargetsChange);
    this.#selection.addEventListener("dispose", this.#onSelectionDispose);
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  set enabled(
    enabled: boolean
  ) {
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

  dispose(): void {
    this.#registry.removeEventListener("peerSelectionChange", this.#onPeerSelectionChange);
    this.#visibility?.removeEventListener("visibilityChange", this.#onVisibilityChange);
    this.#selection.removeEventListener("targetsChange", this.#onTargetsChange);
    this.#selection.removeEventListener("dispose", this.#onSelectionDispose);

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

  #buildSlots(
    selectors: readonly string[]
  ): PeerSelectionChipOptions[] {
    if (selectors.length <= kMaxChips) {
      return selectors.map((peerId) => {
        return {
          color: this.#registry.colorOf(peerId)
        };
      });
    }

    const slots: PeerSelectionChipOptions[] = selectors.slice(0, kMaxChips).map((peerId) => {
      return {
        color: this.#registry.colorOf(peerId)
      };
    });
    slots.push({
      color: kOverflowChipColor,
      label: `+${selectors.length - kMaxChips}`
    });

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
