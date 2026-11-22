// Import Third-party Dependencies
import {
  AssetType,
  type AssetReferenceData
} from "@jolly-pixel/asset";
import {
  Actor,
  ActorComponent,
  Systems
} from "@jolly-pixel/ecs";

// Import Internal Dependencies
import { createSceneSetup } from "./sceneSetup.ts";
import { createWarningLogger } from "./sceneFile.ts";
import { MARKERS_DEFINITION } from "./sceneAnchors.ts";

// CONSTANTS
const kTextureType = new AssetType<string>("texture");

export class TagComponent extends ActorComponent {
  readonly label: string;
  readonly componentContext: Systems.ComponentContext;

  constructor(
    actor: Actor,
    options: { label: string; context: Systems.ComponentContext; }
  ) {
    super({ actor, typeName: "Tag" });
    this.label = options.label;
    this.componentContext = options.context;
  }
}

export const TAG_DEFINITION: Systems.ComponentDefinition<string, TagComponent> = {
  type: "Tag",
  assets: { map: kTextureType, empty: kTextureType, absent: kTextureType },
  parse: (data: Readonly<Systems.JSONObject>) => (typeof data.label === "string" ? data.label : "default"),
  create: (actor, label, context) => actor.addComponentAndGet(TagComponent, { label, context })
};

export function createInstance(
  mode: Systems.SceneMode,
  options: Pick<Systems.SceneInstanceOptions, "prefabs" | "sceneId"> & { graph?: Systems.SceneGraph; } = {}
) {
  const { graph, ...instanceOptions } = options;
  const { logger, warnings } = createWarningLogger();
  const { sm, world } = createSceneSetup({ logger, graph });
  const resolved: AssetReferenceData[] = [];
  const instance = new Systems.SceneInstance({
    world: world as any,
    mode,
    components: new Systems.ComponentDefinitions().register(
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
