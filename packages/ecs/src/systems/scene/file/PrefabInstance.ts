// Import Internal Dependencies
import { PrefabOverrides } from "./PrefabOverrides.ts";
import type { SceneActorFile } from "./SceneFile.ts";
import type { ScenePrefabs } from "./ScenePrefabs.ts";

export interface PrefabRescope {
  previous: SceneActorFile;
  scoped: SceneActorFile;
}

export class PrefabInstance {
  static parse(
    file: Readonly<SceneActorFile>,
    chain: readonly string[]
  ): PrefabInstance | null {
    return file.prefab === undefined ?
      null :
      new PrefabInstance(
        file.id,
        file.prefab.id,
        chain,
        PrefabOverrides.from(file.overrides)
      );
  }

  readonly id: string;
  readonly sceneId: string;
  readonly chain: readonly string[];

  #overrides: PrefabOverrides;
  #files: readonly SceneActorFile[] = [];
  #expanded = new Map<string, SceneActorFile>();
  #roots: readonly string[] = [];

  constructor(
    id: string,
    sceneId: string,
    chain: readonly string[],
    overrides: PrefabOverrides
  ) {
    this.id = id;
    this.sceneId = sceneId;
    this.chain = chain;
    this.#overrides = overrides;
  }

  get cyclic(): boolean {
    return this.chain.includes(this.sceneId);
  }

  get innerChain(): readonly string[] {
    return [...this.chain, this.sceneId];
  }

  get roots(): readonly string[] {
    return this.#roots;
  }

  get expanded(): ReadonlyMap<string, SceneActorFile> {
    return this.#expanded;
  }

  expand(
    prefabs: ScenePrefabs
  ): SceneActorFile[] | null {
    const scene = this.cyclic ? null : prefabs.find(this.sceneId);
    if (scene === null) {
      return null;
    }

    const files = scene.actors.map(
      (file) => this.#overrides.scope(file, this.id)
    );
    this.#files = scene.actors;
    this.#roots = files
      .filter((file) => file.parentId === this.id)
      .map((file) => file.id);
    this.#expanded = new Map(files.map((file) => [file.id, file]));

    return files;
  }

  retain(
    built: (id: string) => boolean
  ): void {
    for (const id of this.#expanded.keys()) {
      if (!built(id)) {
        this.#expanded.delete(id);
      }
    }
  }

  collapse(): readonly string[] {
    const roots = this.#roots;
    this.#files = [];
    this.#expanded = new Map();
    this.#roots = [];

    return roots;
  }

  rescope(
    overrides: PrefabOverrides
  ): PrefabRescope[] {
    this.#overrides = overrides;

    const changes: PrefabRescope[] = [];
    for (const file of this.#files) {
      const scoped = overrides.scope(file, this.id);
      const previous = this.#expanded.get(scoped.id);
      if (previous !== undefined) {
        this.#expanded.set(scoped.id, scoped);
        changes.push({
          previous,
          scoped
        });
      }
    }

    return changes;
  }
}
