// Import Third-party Dependencies
import type { SceneDocument } from "@jolly-pixel/asset.scene/client";
import {
  ActorComponent,
  Systems,
  type Actor
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { PrefabScenes } from "../../src/scene/PrefabScenes.ts";
import { createSceneBinding } from "./sceneBinding.ts";

export class Probe extends ActorComponent {
  label: string;

  constructor(
    actor: Actor,
    options: { label: string; }
  ) {
    super({ actor, typeName: "Probe" });
    this.label = options.label;
  }
}

function parseLabel(
  data: Readonly<Systems.JSONObject>
): string {
  return typeof data.label === "string" ? data.label : "none";
}

const kPatched: Systems.ComponentDefinition<string, Probe> = {
  type: "Patched",
  parse: parseLabel,
  create: (actor, label) => actor.addComponentAndGet(Probe, { label }),
  apply: (probe, label) => {
    probe.label = label;
  }
};

const kRebuilt: Systems.ComponentDefinition<string, Probe> = {
  type: "Rebuilt",
  parse: parseLabel,
  create: (actor, label) => actor.addComponentAndGet(Probe, { label })
};

export function createProbeBinding(
  document: SceneDocument,
  prefabs?: PrefabScenes
) {
  return createSceneBinding(
    document,
    new Systems.ComponentDefinitions().register(kPatched, kRebuilt),
    prefabs
  );
}
