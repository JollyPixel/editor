// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  SceneActorJSON,
  SceneComponentJSON,
  SceneTransformJSON
} from "../network/client.ts";
import {
  assetReferenceSchema,
  componentDataSchema,
  sceneTransformSchema
} from "../network/SceneCommand.schema.ts";
import type { SceneRefs } from "./SceneRefs.ts";

export const transformPatchSchema = z.partial(sceneTransformSchema).check(
  z.describe("rotation is in Euler angles, in degrees.")
);

export const componentSpecSchema = z.object({
  type: z.string().check(
    z.describe("Camera, Light, Model, …: read a scene to see what exists.")
  ),
  data: z.optional(componentDataSchema.check(
    z.describe("The component's settings. Default {}.")
  )),
  assets: z.optional(z.record(
    z.string(),
    z.nullable(z.union([z.string(), assetReferenceSchema]))
  ).check(z.describe("Asset slots, such as { \"model\": \"models/tree.obj\" }: " +
    "an asset id or catalog path. Default {}.")))
});

export const actorSpecSchema = z.object({
  name: z.string(),
  visible: z.optional(z.boolean().check(z.describe("Default true."))),
  transform: z.optional(transformPatchSchema.check(
    z.describe("y is up. Missing fields: position and rotation 0, scale 1.")
  )),
  components: z.optional(z.array(componentSpecSchema)),
  get children() {
    return z.optional(z.array(actorSpecSchema).check(
      z.describe("Actors added under this one.")
    ));
  }
});

export type ComponentSpec = z.output<typeof componentSpecSchema>;

export type ActorSpec = z.output<typeof actorSpecSchema>;

export interface AddedActor {
  id: string;
  name: string;
}

export function actorList(
  spec: ActorSpec,
  parentId: string | null,
  refs: SceneRefs
): SceneActorJSON[] {
  const id = randomUUID();
  const actor: SceneActorJSON = {
    id,
    name: spec.name,
    parentId,
    visible: spec.visible ?? true,
    transform: {
      position: spec.transform?.position ?? vector(0),
      rotation: spec.transform?.rotation ?? vector(0),
      scale: spec.transform?.scale ?? vector(1)
    },
    components: (spec.components ?? []).map(
      (component) => componentJSON(component, refs)
    )
  };

  return [
    actor,
    ...(spec.children ?? []).flatMap(
      (child) => actorList(child, id, refs)
    )
  ];
}

export function componentJSON(
  spec: ComponentSpec,
  refs: SceneRefs
): SceneComponentJSON {
  return {
    id: randomUUID(),
    type: spec.type,
    data: spec.data ?? {},
    assets: Object.fromEntries(
      Object.entries(spec.assets ?? {}).map(
        ([slot, ref]) => [slot, refs.asset(ref)]
      )
    )
  };
}

function vector(
  value: number
): SceneTransformJSON["position"] {
  return {
    x: value,
    y: value,
    z: value
  };
}
