// Import Internal Dependencies
import { Scene } from "../Scene.ts";
import type { WorldDefaultContext } from "../../World.ts";
import type { ComponentDefinitions } from "./definitions/ComponentDefinitions.ts";
import { CoordinatorAssetResolver } from "./definitions/CoordinatorAssetResolver.ts";
import { SceneInstance } from "./live/SceneInstance.ts";
import { captureSceneActors } from "./live/sceneCapture.ts";
import { SceneEnvironment } from "./live/SceneEnvironment.ts";
import type { SceneFile } from "./SceneFile.ts";
import {
  includedSceneFiles,
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

export class FileScene<
  TContext = WorldDefaultContext
> extends Scene<TContext> {
  readonly file: SceneFile;

  #components: ComponentDefinitions;
  #prefabs: ScenePrefabs;
  #sceneId: string | undefined;
  #environment: SceneEnvironment | null = null;

  constructor(
    name: string,
    file: SceneFile,
    options: FileSceneOptions
  ) {
    const {
      components,
      prefabs = NO_SCENE_PREFABS,
      sceneId
    } = options;

    super(name, {
      assets: Array.from(
        includedSceneFiles(file, prefabs, sceneId),
        (included) => [...components.assets(included)]
      ).flat()
    });
    this.file = file;
    this.#components = components;
    this.#prefabs = prefabs;
    this.#sceneId = sceneId;
  }

  override awake(): void {
    new SceneInstance<TContext>({
      world: this.world,
      mode: "play",
      components: this.#components,
      assets: new CoordinatorAssetResolver(
        this.world.assetCoordinator
      ),
      prefabs: this.#prefabs,
      sceneId: this.#sceneId
    }).add(this.file.actors);

    this.#environment = new SceneEnvironment(this.world);
    this.#environment.apply(
      this.file.environment
    );
  }

  capture(): SceneFile {
    return {
      version: 1,
      environment: structuredClone(this.file.environment),
      actors: captureSceneActors(
        this.world.sceneManager.tree,
        this.#components
      )
    };
  }

  override destroy(): void {
    this.#environment?.dispose();
    this.#environment = null;
  }
}
