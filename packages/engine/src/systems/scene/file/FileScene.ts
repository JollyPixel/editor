// Import Internal Dependencies
import { Scene } from "../Scene.ts";
import type { WorldDefaultContext } from "../../World.ts";
import type { ComponentDefinitions } from "./ComponentDefinitions.ts";
import { CoordinatorAssetResolver } from "./CoordinatorAssetResolver.ts";
import { SceneBuilder } from "./SceneBuilder.ts";
import { SceneEnvironment } from "./SceneEnvironment.ts";
import type { SceneBuild } from "./SceneBuild.ts";
import type { SceneFile } from "./SceneFile.ts";

export interface FileSceneOptions {
  components: ComponentDefinitions;
}

export class FileScene<
  TContext = WorldDefaultContext
> extends Scene<TContext> {
  readonly file: SceneFile;

  #components: ComponentDefinitions;
  #build: SceneBuild<TContext> | null = null;
  #environment: SceneEnvironment | null = null;

  constructor(
    name: string,
    file: SceneFile,
    options: FileSceneOptions
  ) {
    super(name, {
      assets: options.components.assets(file)
    });
    this.file = file;
    this.#components = options.components;
  }

  get build(): SceneBuild<TContext> | null {
    return this.#build;
  }

  override awake(): void {
    const builder = new SceneBuilder<TContext>({
      world: this.world,
      mode: "play",
      components: this.#components,
      assets: new CoordinatorAssetResolver(
        this.world.assetCoordinator
      )
    });
    this.#build = builder.build(this.file.actors);

    this.#environment = new SceneEnvironment(this.world);
    this.#environment.apply(
      this.file.environment
    );
  }

  override destroy(): void {
    this.#environment?.dispose();
    this.#environment = null;
    this.#build = null;
  }
}
