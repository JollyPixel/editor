// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { SelectionOverlay } from "./SelectionOverlay.ts";
import type { SelectableObject } from "../SelectionManager.ts";

export interface SelectionOverlayCreateOptions {
  color: THREE.ColorRepresentation;
  opacity: number;
  /**
   * Forwarded to a technique that supports it (e.g. `SelectionOutline`) -
   * ignored by any technique that doesn't.
   */
  linewidth?: number;
  /**
   * Forwarded to a technique that supports it (e.g. `SelectionBoundingBox`) -
   * ignored by any technique that doesn't.
   */
  fillOpacity?: number;
  xray?: boolean;
  /**
   * Forwarded to a technique that supports it (e.g. `SelectionOutline`'s own
   * `dashed`) - ignored by any technique that doesn't.
   */
  dashed?: boolean;
}

/**
 * One selectable overlay technique - built by `SelectionOverlayRegistry`
 * for a given `id` once `supports(target)` says it applies. Implement and
 * register this to add a new per-object technique instead of forking
 * `createSelectionOverlay`.
 */
export interface SelectionOverlayFactory {
  /**
   * Matched against a `SelectionManager`/`register` technique id (see
   * `SelectionTechnique` on `SelectionManager.ts`).
   */
  readonly id: string;
  /**
   * Whether this technique can render `target` at all - e.g.
   * `SelectionOutline` requires a `THREE.Mesh`.
   */
  supports(target: SelectableObject): boolean;
  /**
   * Only ever called with a `target` this factory's own `supports` already
   * returned `true` for.
   */
  create(target: SelectableObject, options: SelectionOverlayCreateOptions): SelectionOverlay;
}

export interface SelectionOverlayRegistryOptions {
  /**
   * Technique id used when the requested id isn't registered (or doesn't
   * support the target) but this one does. Built-in default: `"outline"`.
   */
  defaultId: string;
  /**
   * Technique id used as a last resort, when neither the requested id nor
   * `defaultId` supports the target - typically the one technique that
   * supports every `SelectableObject`. Built-in default: `"boundingBox"`.
   */
  fallbackId: string;
}

/**
 * Resolves a technique id + target to the `SelectionOverlayFactory` that
 * builds its overlay - open and registerable, replacing a hardcoded
 * `instanceof THREE.Mesh` switch.
 *
 * Resolution order:
 * 1. The requested id, if registered and it supports `target`.
 * 2. `defaultId`, if it supports `target` - an unrecognized id on a
 *    `THREE.Mesh` (e.g. a scene-level id like `"highlight"` reaching here by
 *    mistake) falls back here instead of throwing.
 * 3. `fallbackId` - what every other target (typically a `THREE.Group`)
 *    always gets, regardless of the requested id.
 */
export class SelectionOverlayRegistry {
  #factories = new Map<string, SelectionOverlayFactory>();
  #defaultId: string;
  #fallbackId: string;

  constructor(
    options: SelectionOverlayRegistryOptions
  ) {
    this.#defaultId = options.defaultId;
    this.#fallbackId = options.fallbackId;
  }

  /**
   * Registers `factory` under its own `id`, replacing any previously
   * registered factory with the same id.
   */
  register(
    factory: SelectionOverlayFactory
  ): void {
    this.#factories.set(factory.id, factory);
  }

  resolve(
    id: string,
    target: SelectableObject
  ): SelectionOverlayFactory {
    const requested = this.#factories.get(id);
    if (requested?.supports(target)) {
      return requested;
    }

    const defaultFactory = this.#factories.get(this.#defaultId);
    if (defaultFactory?.supports(target)) {
      return defaultFactory;
    }

    const fallback = this.#factories.get(this.#fallbackId);
    if (!fallback) {
      throw new Error(
        `SelectionOverlayRegistry: fallback technique "${this.#fallbackId}" is not registered`
      );
    }

    return fallback;
  }
}
