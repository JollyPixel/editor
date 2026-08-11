// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { SelectionOutline } from "./SelectionOutline.ts";
import { SelectionBoundingBox } from "./SelectionBoundingBox.ts";

export type SelectableObject = THREE.Mesh | THREE.Object3D;
type SelectionOverlay = SelectionOutline | SelectionBoundingBox;

export interface SelectionManagerOptions {
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * @default "#8ab4f8"
   */
  hoverColor?: THREE.ColorRepresentation;
  /**
   * @default 0.35
   */
  hoverOpacity?: number;
}

/**
 * Tracks a single selected id and a single hovered id across a pool of
 * registered objects, rendering a `SelectionOutline` for a `THREE.Mesh` or a
 * `SelectionBoundingBox` for anything else (typically a `THREE.Group`) -
 * callers never need to know which overlay a given id resolves to.
 *
 * Objects are addressed by a caller-assigned string id rather than by
 * object reference so that a UI outside the 3D view (e.g. a `TreeView` from
 * `@jolly-pixel/fs-tree`) can drive selection without holding onto
 * `THREE.Object3D` instances itself - it only needs to agree on ids.
 * Dispatches plain `Event`s (`selectionChange`, `hoverChange`) rather than
 * `CustomEvent`s, matching `TreeView`'s own `selectionChange` event: state is
 * read back via the `selected`/`hovered` getters, not the event.
 */
export class SelectionManager extends EventTarget {
  #targets = new Map<string, SelectableObject>();
  #color: THREE.ColorRepresentation;
  #hoverColor: THREE.ColorRepresentation;
  #hoverOpacity: number;

  #selectedId: string | null = null;
  #selectedOverlay: SelectionOverlay | null = null;
  #hoveredId: string | null = null;
  #hoverOverlay: SelectionOverlay | null = null;

  constructor(
    options: SelectionManagerOptions = {}
  ) {
    super();

    this.#color = options.color ?? "#ffffff";
    this.#hoverColor = options.hoverColor ?? "#8ab4f8";
    this.#hoverOpacity = options.hoverOpacity ?? 0.35;
  }

  get selected(): string | null {
    return this.#selectedId;
  }

  get hovered(): string | null {
    return this.#hoveredId;
  }

  register(
    id: string,
    target: SelectableObject
  ): void {
    this.#targets.set(id, target);
  }

  /**
   * Drops `id` from the registry, clearing selection/hover overlays first if
   * `id` currently holds either.
   */
  unregister(
    id: string
  ): void {
    if (this.#selectedId === id) {
      this.select(null);
    }
    if (this.#hoveredId === id) {
      this.hover(null);
    }
    this.#targets.delete(id);
  }

  select(
    id: string | null
  ): void {
    if (id === this.#selectedId) {
      return;
    }

    this.#selectedOverlay?.dispose();
    this.#selectedOverlay = null;
    this.#selectedId = id;

    if (id !== null) {
      this.#selectedOverlay = this.#createOverlay(id, this.#color, 1);

      // Selected already reads as outlined - no need for a dimmer hover overlay underneath.
      if (this.#hoveredId === id) {
        this.#hoverOverlay?.dispose();
        this.#hoverOverlay = null;
      }
    }

    this.dispatchEvent(new Event("selectionChange"));
  }

  hover(
    id: string | null
  ): void {
    if (id === this.#hoveredId) {
      return;
    }

    this.#hoverOverlay?.dispose();
    this.#hoverOverlay = null;
    this.#hoveredId = id;

    if (id !== null && id !== this.#selectedId) {
      this.#hoverOverlay = this.#createOverlay(id, this.#hoverColor, this.#hoverOpacity);
    }

    this.dispatchEvent(new Event("hoverChange"));
  }

  /**
   * Disposes any active overlays and forgets every registered id. The
   * manager can be reused afterward via `register`.
   */
  dispose(): void {
    this.select(null);
    this.hover(null);
    this.#targets.clear();
  }

  #createOverlay(
    id: string,
    color: THREE.ColorRepresentation,
    opacity: number
  ): SelectionOverlay {
    const target = this.#targets.get(id);
    if (!target) {
      throw new Error(`SelectionManager: no object registered for id "${id}"`);
    }

    return target instanceof THREE.Mesh ?
      new SelectionOutline({ target, color, opacity }) :
      new SelectionBoundingBox({ target, color, opacity });
  }
}
