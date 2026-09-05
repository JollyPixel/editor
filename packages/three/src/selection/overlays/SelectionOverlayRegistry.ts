// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { SelectionOverlay } from "./SelectionOverlay.ts";
import type {
  SelectionOverlayFactory,
  SelectionOverlayCreateOptions
} from "./SelectionOverlayFactory.ts";
import type { SelectionTechnique } from "../SelectionManager.ts";

export interface SelectionOverlayRegistryOptions {
  /**
   * Technique used when the requested one cannot render the target.
   */
  defaultId: string;
  /**
   * Technique used when `defaultId` also cannot render the target.
   */
  fallbackId: string;
}

export interface CreateSelectionOverlayOptions extends SelectionOverlayCreateOptions {
  technique: SelectionTechnique;
}

/**
 * Resolves the requested, default, then fallback overlay factory.
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
   * Replaces any factory registered with the same id.
   */
  register(
    factory: SelectionOverlayFactory
  ): void {
    this.#factories.set(factory.id, factory);
  }

  resolve(
    id: string,
    target: THREE.Object3D
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
    if (!fallback.supports(target)) {
      throw new Error(
        `SelectionOverlayRegistry: no technique supports target "${target.name}"`
      );
    }

    return fallback;
  }

  create(
    target: THREE.Object3D,
    options: CreateSelectionOverlayOptions
  ): SelectionOverlay {
    const { technique, ...createOptions } = options;

    return this
      .resolve(technique, target)
      .create(target, createOptions);
  }
}
