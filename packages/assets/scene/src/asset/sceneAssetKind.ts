// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  arbitrated,
  JSON_CONTENT_TYPE,
  JsonAssetFile,
  SNAPSHOT_OPTIONS_SCHEMA,
  type AssetKindHandler,
  type AssetKindPackage,
  type SnapshotPolicy
} from "@jolly-pixel/asset-server";
import { InvalidEntryError } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import {
  createSceneFile,
  SCENE_ASSET,
  SCENE_COMMAND,
  SCENE_EXTENSION,
  SCENE_FILE_VERSION,
  SCENE_KIND,
  type SceneFile
} from "./scene.ts";
import {
  compactSceneFile,
  compactSceneFileSchema,
  expandSceneFile
} from "./sceneFile.ts";
import {
  SceneTree,
  type SceneTreeOptions
} from "../model/SceneTree.ts";
import {
  sceneCommandProtocol,
  sceneSnapshotSchema
} from "../network/SceneCommand.schema.ts";
import { sceneConflictKeys } from "../network/SceneCommandKeys.ts";
import type {
  AssetReferenceJSON,
  SceneActorJSON,
  SceneCommand,
  SceneNetworkCommand,
  SceneSnapshot
} from "../network/types.ts";

// CONSTANTS
export const SCENE_FILE = new JsonAssetFile({
  kind: SCENE_KIND,
  schema: compactSceneFileSchema,
  expand: expandSceneFile,
  compact: compactSceneFile,
  isInvalid: (error) => error instanceof InvalidEntryError
});

export class SceneState {
  #tree: SceneTree;

  constructor(
    options: SceneTreeOptions = {}
  ) {
    this.#tree = new SceneTree(options);
  }

  load(
    file: SceneFile
  ): void {
    this.#tree.load(file);
  }

  clear(): void {
    this.#tree.clear();
  }

  accepts(
    command: SceneCommand
  ): boolean {
    return this.#tree.accepts(command);
  }

  conflictKeys(
    command: SceneCommand
  ): string[] {
    return sceneConflictKeys(command, this.#tree.erasedBy(command));
  }

  applyCommand(
    command: SceneCommand
  ): void {
    this.#tree.apply(command);
  }

  dependencies(): AssetReferenceData[] {
    const references = new Map<string, AssetReferenceData>();
    for (const actor of this.#tree.actors()) {
      for (const reference of actorReferences(actor)) {
        references.set(`${reference.kind}:${reference.id}`, {
          id: reference.id,
          kind: reference.kind
        });
      }
    }

    return [...references.values()];
  }

  rebind(
    idMap: ReadonlyMap<string, string>
  ): void {
    const file = this.toJSON();

    this.load({
      ...file,
      actors: file.actors.map((actor) => {
        return {
          ...actor,
          ...actor.prefab === undefined ? {} : { prefab: remapReference(actor.prefab, idMap) },
          components: actor.components.map((component) => {
            return {
              ...component,
              assets: Object.fromEntries(
                Object.entries(component.assets).map(
                  ([slot, reference]) => [slot, reference === null ? null : remapReference(reference, idMap)]
                )
              )
            };
          })
        };
      })
    });
  }

  snapshot(): SceneSnapshot {
    return this.#tree.toJSON();
  }

  toJSON(): SceneFile {
    return {
      version: SCENE_FILE_VERSION,
      ...this.snapshot()
    };
  }
}

export interface SceneAssetKindOptions {
  snapshot?: SnapshotPolicy;
}

export function sceneAssetKind(
  options: SceneAssetKindOptions = {}
): AssetKindHandler<SceneState, SceneNetworkCommand> {
  const { snapshot } = options;

  return {
    kind: SCENE_KIND,
    extensions: {
      [SCENE_EXTENSION]: JSON_CONTENT_TYPE
    },
    snapshot,

    create(
      assetId: string
    ): SceneState {
      const state = new SceneState({ sceneId: assetId });
      state.load(createSceneFile());

      return state;
    },

    load(
      state: SceneState,
      content: Uint8Array
    ): void {
      SCENE_FILE.load(content, (file) => state.load(file));
    },

    clear(
      state: SceneState
    ): void {
      state.clear();
    },

    serialize(
      state: SceneState
    ): Promise<Uint8Array> {
      return Promise.resolve(
        SCENE_FILE.encode(state.toJSON())
      );
    },

    dependencies(
      state: SceneState
    ) {
      return state.dependencies();
    },

    rebind(
      state: SceneState,
      idMap: ReadonlyMap<string, string>
    ): void {
      state.rebind(idMap);
    },

    commands: {
      eventType: SCENE_COMMAND,
      protocol: sceneCommandProtocol,

      apply(state, command) {
        state.applyCommand(command);
      },

      live({ state }) {
        return {
          snapshotSchema: sceneSnapshotSchema,
          snapshot: () => state.snapshot(),
          ...arbitrated(state, {
            accepts: (scene, command) => scene.accepts(command),
            writes: (command, scene) => {
              return { keys: scene?.conflictKeys(command) ?? sceneConflictKeys(command, []) };
            }
          })
        };
      }
    }
  };
}

export const ASSET_KINDS: AssetKindPackage<SceneAssetKindOptions> = {
  descriptors: [SCENE_ASSET],
  optionsSchema: SNAPSHOT_OPTIONS_SCHEMA,
  handlers: (options) => [sceneAssetKind(options)]
};

function actorReferences(
  actor: SceneActorJSON
): AssetReferenceJSON[] {
  return [
    ...actor.prefab === undefined ? [] : [actor.prefab],
    ...actor.components.flatMap(
      ({ assets }) => Object.values(assets).filter((reference) => reference !== null)
    )
  ];
}

function remapReference(
  reference: AssetReferenceJSON,
  idMap: ReadonlyMap<string, string>
): AssetReferenceJSON {
  return {
    ...reference,
    id: idMap.get(reference.id) ?? reference.id
  };
}
