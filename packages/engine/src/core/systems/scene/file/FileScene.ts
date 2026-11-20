// Import Third-party Dependencies
import { AssetReference } from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  Scene,
  type LoadableAssets
} from "../Scene.ts";
import type { WorldDefaultContext } from "../../World.ts";
import type { ComponentDefinitions } from "./definitions/ComponentDefinitions.ts";
import { CoordinatorAssetResolver } from "./definitions/CoordinatorAssetResolver.ts";
import { SceneInstance } from "./live/SceneInstance.ts";
import { captureSceneActors } from "./live/sceneCapture.ts";
import { connectSceneSignals } from "./live/sceneConnections.ts";
import type { SceneFile } from "./SceneFile.ts";
import type { SceneEnvironment } from "../SceneGraph.ts";
import {
  ENVIRONMENT_ASSET,
  type EnvironmentFile
} from "../../environment/EnvironmentFile.ts";
import { ENVIRONMENT_PRESETS } from "../../environment/EnvironmentPresets.ts";
import {
  expandedSceneActors,
  NO_SCENE_PREFABS,
  type ScenePrefabs
} from "./ScenePrefabs.ts";

export interface FileSceneOptions {
  components: ComponentDefinitions;
  /**
   * Scene files that prefab instances expand, with every scene they include.
   */
  prefabs?: ScenePrefabs;
  /**
   * Id of the scene file, never expanded as a prefab inside itself.
   */
  sceneId?: string;
}

export type SceneFileLoad = () => Promise<SceneFile>;

export class FileScene<
  TContext = WorldDefaultContext
> extends Scene<TContext> {
  #file: SceneFile | SceneFileLoad;
  #components: ComponentDefinitions;
  #prefabs: ScenePrefabs;
  #sceneId: string | undefined;
  #environment: SceneEnvironment | null = null;

  constructor(
    name: string,
    file: SceneFile | SceneFileLoad,
    options: FileSceneOptions
  ) {
    super(name);
    this.#file = file;
    this.#components = options.components;
    this.#prefabs = options.prefabs ?? NO_SCENE_PREFABS;
    this.#sceneId = options.sceneId;
  }

  get file(): SceneFile {
    if (typeof this.#file === "function") {
      throw new Error(`Scene "${this.name}" has not loaded its file yet.`);
    }

    return this.#file;
  }

  override prepare(): Promise<void> | void {
    const file = this.#file;
    if (typeof file !== "function") {
      return undefined;
    }

    return file().then((loaded) => {
      this.#file = loaded;
    });
  }

  override assetsToLoad(
    loadable: LoadableAssets
  ): Iterable<AssetReference<unknown>> {
    const actors = [
      ...expandedSceneActors(this.file.actors, this.#prefabs, this.#sceneId)
    ];

    const references: AssetReference<unknown>[] = [
      ...this.#components.assets({ actors })
    ];
    const environment = this.#environmentReference();
    if (environment !== null) {
      references.push(environment);
    }

    return references.filter(
      (reference) => loadable.canLoad(reference)
    );
  }

  override awake(): void {
    const instance = new SceneInstance<TContext>({
      world: this.world,
      mode: "play",
      components: this.#components,
      assets: new CoordinatorAssetResolver(
        this.world.assetCoordinator
      ),
      prefabs: this.#prefabs,
      sceneId: this.#sceneId
    });
    instance.add(this.file.actors);
    connectSceneSignals(
      instance,
      this.world.logger.child({ namespace: "Systems.FileScene" })
    );

    this.#environment = this.world.sceneManager.graph.createEnvironment(
      this.world
    );
    this.#environment.apply(
      this.#environmentFile()
    );
  }

  capture(): SceneFile {
    return {
      version: 1,
      environment: this.file.environment === null ?
        null :
        { ...this.file.environment },
      actors: captureSceneActors(
        this.world.sceneManager.tree,
        this.#components
      )
    };
  }

  #environmentReference(): AssetReference<EnvironmentFile> | null {
    const { environment } = this.file;

    return environment === null ?
      null :
      AssetReference.parse(environment, ENVIRONMENT_ASSET);
  }

  #environmentFile(): Readonly<EnvironmentFile> {
    const reference = this.#environmentReference();
    if (
      reference === null ||
      !this.world.assetCoordinator.canLoad(reference)
    ) {
      return ENVIRONMENT_PRESETS.default;
    }

    return this.world.assetCoordinator.get(reference);
  }

  override destroy(): void {
    this.#environment?.dispose();
    this.#environment = null;
  }
}
