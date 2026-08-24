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
}

/**
 * One selectable overlay technique - built by `SelectionOverlayRegistry` for
 * a given `id` once `supports(target)` says it applies. A caller adding a
 * new per-object technique (e.g. another editor in this monorepo wanting a
 * different visual style than `outline`) implements this and registers it,
 * rather than forking `createSelectionOverlay`.
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
   * Technique id resolved to when the requested id isn't registered (or its
   * factory doesn't support the target) but some registered technique does -
   * what a `THREE.Mesh` target got for any unrecognized style before this
   * registry existed (built-in default: `"outline"`).
   */
  defaultId: string;
  /**
   * Technique id resolved to as the last resort, once neither the requested
   * id nor `defaultId` supports the target - typically the one technique
   * that supports every `SelectableObject` (built-in default:
   * `"boundingBox"`), so it's always eligible here.
   */
  fallbackId: string;
}

/**
 * Resolves a technique id + target to the `SelectionOverlayFactory` that
 * should build its overlay - the open, registerable replacement for
 * `createSelectionOverlay`'s previous hardcoded `instanceof THREE.Mesh`
 * switch.
 *
 * Three-tier resolution, chosen to reproduce that switch's exact prior
 * behavior so opening it up this way is a pure refactor for every id already
 * in use:
 * 1. The requested id, if registered and it supports `target`.
 * 2. `defaultId`, if it supports `target` - a `THREE.Mesh` target given an id
 *    this registry doesn't know about (e.g. a scene-level pipeline style id
 *    like `"coloredOutline"` reaching here by mistake) silently falls back to
 *    this instead of throwing, same as before.
 * 3. `fallbackId` - what every target none of the above support (typically a
 *    `THREE.Group`, via `"boundingBox"`) always got before, regardless of
 *    the requested id.
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
