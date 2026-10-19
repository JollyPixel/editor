// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { computeLocalBoundingBox } from "../overlays/computeLocalBoundingBox.ts";
import {
  PeerSelectionChip,
  type PeerSelectionChipOptions
} from "./PeerSelectionChip.ts";
import type { PeerHighlights } from "./PeerHighlights.ts";
import type { PeerVisibility } from "./PeerVisibility.ts";
import type { MeshHighlightState } from "../MeshHighlightState.ts";

// CONSTANTS
const kChipSpacing = 0.4;
const kChipMarginY = 0.35;
const kMaxChips = 3;
const kOverflowChipColor = "#4a4a4a";

export interface PeerSelectionChipsOptions {
  peers: PeerHighlights;
  state: MeshHighlightState;
  /**
   * Suppresses chip rows for objects reported as invisible.
   */
  visibility?: PeerVisibility;
  /**
   * Enables chip rows.
   * @default false
   */
  enabled?: boolean;
}

export class PeerSelectionChips {
  #peers: PeerHighlights;
  #state: MeshHighlightState;
  #visibility: PeerVisibility | null;
  #enabled: boolean;
  #groups = new Map<string, THREE.Group>();

  constructor(
    options: PeerSelectionChipsOptions
  ) {
    this.#peers = options.peers;
    this.#state = options.state;
    this.#visibility = options.visibility ?? null;
    this.#enabled = options.enabled ?? false;
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
    this.sync();
  }

  sync(): void {
    const objectIds = new Set([
      ...this.#groups.keys(),
      ...this.#peers.selectedObjectIds()
    ]);
    for (const objectId of objectIds) {
      this.#refresh(objectId);
    }
  }

  dispose(): void {
    for (const group of this.#groups.values()) {
      this.#disposeGroup(group);
    }
    this.#groups.clear();
  }

  #refresh(
    objectId: string
  ): void {
    const selectors = this.#peers.selectors(objectId);
    const target = this.#state.findTarget(objectId);
    const visible = this.#visibility === null || this.#visibility.isVisible(objectId);
    const existing = this.#groups.get(objectId);

    if (!this.#enabled || selectors.length <= 1 || !visible || !target) {
      if (existing) {
        this.#disposeGroup(existing);
        this.#groups.delete(objectId);
      }

      return;
    }

    const slots = this.#buildSlots(selectors);

    if (
      existing &&
      existing.parent === target &&
      existing.children.length === slots.length
    ) {
      slots.forEach((slot, index) => {
        const chip = existing.children[index];
        if (!(chip instanceof PeerSelectionChip)) {
          return;
        }
        if (chip.color !== slot.color) {
          chip.color = slot.color;
        }
        if (chip.label !== slot.label) {
          chip.label = slot.label;
        }
      });

      return;
    }

    if (existing) {
      this.#disposeGroup(existing);
      this.#groups.delete(objectId);
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
          color: this.#peers.peerColor(peerId)
        };
      });
    }

    const slots: PeerSelectionChipOptions[] = selectors.slice(0, kMaxChips).map((peerId) => {
      return {
        color: this.#peers.peerColor(peerId)
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
