// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import {
  MeshHighlightAppearance,
  type MeshHighlightAppearanceOptions
} from "./MeshHighlightAppearance.ts";

export type SelectableObject = THREE.Object3D;

export type MeshHighlightMode = "outline" | "highlight" | "highlightJfa";

export type MeshHighlightChangeKind =
  | "selection"
  | "hover"
  | "emphasis"
  | "targets"
  | "appearance"
  | "technique"
  | "peers"
  | "visibility";

export interface MeshHighlightChangeEventDetail {
  kind: MeshHighlightChangeKind;
  objectIds: readonly string[];
}

export type HighlightTechnique =
  | "outline"
  | "boxSilhouette"
  | "silhouette"
  | "highlight"
  | "highlightJfa"
  | (string & {});

const SCENE_PIPELINE_TECHNIQUES = new Set<HighlightTechnique>(["highlight", "highlightJfa"]);

export function isScenePipelineTechnique(
  technique: HighlightTechnique
): boolean {
  return SCENE_PIPELINE_TECHNIQUES.has(technique);
}

export interface MeshHighlightStateOptions {
  appearance?: MeshHighlightAppearance | MeshHighlightAppearanceOptions;
  technique?: MeshHighlightMode;
}

export class MeshHighlightState {
  technique: MeshHighlightMode;
  appearance: MeshHighlightAppearance;

  #targets = new Map<string, SelectableObject>();
  #techniques = new Map<string, HighlightTechnique>();
  #selectedId: string | null = null;
  #hoveredId: string | null = null;
  #emphasizedIds: ReadonlySet<string> = new Set();

  constructor(
    options: MeshHighlightStateOptions = {}
  ) {
    this.technique = options.technique ?? "outline";
    this.appearance = options.appearance instanceof MeshHighlightAppearance ?
      options.appearance :
      new MeshHighlightAppearance(options.appearance);
  }

  get selected(): string | null {
    return this.#selectedId;
  }

  get hovered(): string | null {
    return this.#hoveredId;
  }

  get emphasized(): ReadonlySet<string> {
    return this.#emphasizedIds;
  }

  register(
    id: string,
    target: SelectableObject,
    options: { technique?: HighlightTechnique; } = {}
  ): MeshHighlightChangeEventDetail[] {
    this.#targets.set(id, target);
    if (options.technique) {
      this.#techniques.set(id, options.technique);
    }
    else {
      this.#techniques.delete(id);
    }

    return [{ kind: "targets", objectIds: [id] }];
  }

  unregister(
    id: string
  ): MeshHighlightChangeEventDetail[] {
    const changes: MeshHighlightChangeEventDetail[] = [];
    if (this.#selectedId === id) {
      changes.push(...this.select(null));
    }
    if (this.#hoveredId === id) {
      changes.push(...this.hover(null));
    }
    if (this.#emphasizedIds.has(id)) {
      changes.push(
        ...this.emphasize([...this.#emphasizedIds].filter((emphasizedId) => emphasizedId !== id))
      );
    }
    this.#targets.delete(id);
    this.#techniques.delete(id);
    changes.push({ kind: "targets", objectIds: [id] });

    return changes;
  }

  select(
    id: string | null
  ): MeshHighlightChangeEventDetail[] {
    if (id === this.#selectedId) {
      return [];
    }
    if (id !== null) {
      this.#requireTarget(id);
    }

    const previousId = this.#selectedId;
    this.#selectedId = id;

    return [{ kind: "selection", objectIds: changedIds(previousId, id) }];
  }

  hover(
    id: string | null
  ): MeshHighlightChangeEventDetail[] {
    if (id === this.#hoveredId) {
      return [];
    }
    if (id !== null) {
      this.#requireTarget(id);
    }

    const previousId = this.#hoveredId;
    this.#hoveredId = id;

    return [{ kind: "hover", objectIds: changedIds(previousId, id) }];
  }

  emphasize(
    ids: Iterable<string>
  ): MeshHighlightChangeEventDetail[] {
    const next = new Set(ids);
    for (const id of next) {
      this.#requireTarget(id);
    }

    const changed = [...symmetricDifference(this.#emphasizedIds, next)];
    if (changed.length === 0) {
      return [];
    }
    this.#emphasizedIds = next;

    return [{ kind: "emphasis", objectIds: changed }];
  }

  resolveTechnique(
    id: string
  ): HighlightTechnique {
    return this.#techniques.get(id) ?? this.technique;
  }

  findTarget(
    id: string
  ): SelectableObject | undefined {
    return this.#targets.get(id);
  }

  dispose(): void {
    this.#selectedId = null;
    this.#hoveredId = null;
    this.#emphasizedIds = new Set();
    this.#targets.clear();
    this.#techniques.clear();
  }

  #requireTarget(
    id: string
  ): SelectableObject {
    const target = this.#targets.get(id);
    if (!target) {
      throw new Error(`MeshHighlight: no object registered for id "${id}"`);
    }

    return target;
  }
}

export function changedIds(
  previousId: string | null,
  nextId: string | null
): string[] {
  return [...new Set([previousId, nextId].filter((id) => id !== null))];
}

function* symmetricDifference(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): IterableIterator<string> {
  for (const id of left) {
    if (!right.has(id)) {
      yield id;
    }
  }
  for (const id of right) {
    if (!left.has(id)) {
      yield id;
    }
  }
}
