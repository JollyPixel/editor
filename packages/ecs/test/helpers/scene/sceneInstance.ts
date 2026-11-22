// Import Third-party Dependencies
import {
  AssetType,
  type AssetReferenceData
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import { ActorComponent } from "../../../src/actor/ActorComponent.ts";
import {
  ComponentDefinitions,
  SceneInstance,
  type ComponentContext,
  type ComponentDefinition,
  type JSONObject,
  type SceneInstanceOptions,
  type SceneMode
} from "../../../src/systems/scene/file/index.ts";
import type { SceneGraph } from "../../../src/systems/scene/SceneGraph.ts";
import { createSceneSetup } from "./sceneSetup.ts";
import { createWarningLogger } from "./sceneFile.ts";
import { MARKERS_DEFINITION } from "./sceneAnchors.ts";

// CONSTANTS
const kTextureType = new AssetType<string>("texture");

export class TagComponent extends ActorComponent {
  readonly label: string;
  readonly componentContext: ComponentContext;

  constructor(
    actor: Actor,
    options: { label: string; context: ComponentContext; }
  ) {
    super({ actor, typeName: "Tag" });
    this.label = options.label;
    this.componentContext = options.context;
  }
}

export const TAG_DEFINITION: ComponentDefinition<string, TagComponent> = {
  type: "Tag",
  assets: { map: kTextureType, empty: kTextureType, absent: kTextureType },
  parse: (data: Readonly<JSONObject>) => (typeof data.label === "string" ? data.label : "default"),
  create: (actor, label, context) => actor.addComponentAndGet(TagComponent, { label, context })
};

export function createInstance(
  mode: SceneMode,
  options: Pick<SceneInstanceOptions, "prefabs" | "sceneId"> & { graph?: SceneGraph; } = {}
) {
  const { graph, ...instanceOptions } = options;
  const { logger, warnings } = createWarningLogger();
  const { sm, world } = createSceneSetup({ logger, graph });
  const resolved: AssetReferenceData[] = [];
  const instance = new SceneInstance({
    world: world as any,
    mode,
    components: new ComponentDefinitions().register(
      TAG_DEFINITION,
      MARKERS_DEFINITION
    ),
    assets: {
      resolve: (reference, _type) => {
        resolved.push(reference);

        return `value:${reference.id}` as never;
      }
    },
    ...instanceOptions
  });

  return { sm, instance, warnings, resolved };
}
