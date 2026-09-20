// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import type { HighlightOverlay } from "./HighlightOverlay.ts";
import type {
  HighlightOverlayFactory,
  HighlightOverlayCreateOptions
} from "./HighlightOverlayFactory.ts";
import type { HighlightTechnique } from "../MeshHighlightState.ts";

export interface HighlightOverlayRegistryOptions {
  /**
   * Technique used when the requested one cannot render the target.
   */
  defaultId: string;
  /**
   * Technique used when `defaultId` also cannot render the target.
   */
  fallbackId: string;
}

export interface CreateHighlightOverlayOptions extends HighlightOverlayCreateOptions {
  technique: HighlightTechnique;
}

/**
 * Resolves the requested, default, then fallback overlay factory.
 */
export class HighlightOverlayRegistry {
  #factories = new Map<string, HighlightOverlayFactory>();
  #defaultId: string;
  #fallbackId: string;

  constructor(
    options: HighlightOverlayRegistryOptions
  ) {
    this.#defaultId = options.defaultId;
    this.#fallbackId = options.fallbackId;
  }

  /**
   * Replaces any factory registered with the same id.
   */
  register(
    factory: HighlightOverlayFactory
  ): void {
    this.#factories.set(factory.id, factory);
  }

  resolve(
    id: string,
    target: THREE.Object3D
  ): HighlightOverlayFactory {
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
        `HighlightOverlayRegistry: fallback technique "${this.#fallbackId}" is not registered`
      );
    }
    if (!fallback.supports(target)) {
      throw new Error(
        `HighlightOverlayRegistry: no technique supports target "${target.name}"`
      );
    }

    return fallback;
  }

  create(
    target: THREE.Object3D,
    options: CreateHighlightOverlayOptions
  ): HighlightOverlay {
    const { technique, ...createOptions } = options;

    return this
      .resolve(technique, target)
      .create(target, createOptions);
  }
}
