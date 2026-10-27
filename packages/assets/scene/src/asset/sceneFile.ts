// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import { SceneTransform } from "../model/SceneTransform.ts";
import {
  sceneActorSchema,
  sceneSnapshotSchema,
  sceneTransformSchema
} from "../network/SceneCommand.schema.ts";
import type { SceneActorJSON } from "../network/types.ts";
import {
  SCENE_FILE_VERSION,
  type SceneFile
} from "./scene.ts";

// CONSTANTS
const kCompactActorSchema = z.extend(sceneActorSchema, {
  visible: z.optional(z.boolean()),
  transform: z.optional(z.partial(sceneTransformSchema))
});

export const compactSceneFileSchema = z.object({
  version: z.literal(SCENE_FILE_VERSION),
  environment: sceneSnapshotSchema.shape.environment,
  actors: z.array(kCompactActorSchema)
});

export type CompactSceneFile = Infer<typeof compactSceneFileSchema>;
type CompactSceneActor = CompactSceneFile["actors"][number];

export function compactSceneFile(
  file: SceneFile
): CompactSceneFile {
  return {
    ...file,
    actors: file.actors.map(compactActor)
  };
}

export function expandSceneFile(
  compact: CompactSceneFile
): SceneFile {
  return {
    ...compact,
    actors: compact.actors.map(expandActor)
  };
}

function compactActor(
  actor: SceneActorJSON
): CompactSceneActor {
  const { visible, transform, ...rest } = actor;
  const compactTransform = SceneTransform.compact(transform);

  return {
    ...rest,
    ...visible ? {} : { visible },
    ...Object.keys(compactTransform).length === 0 ? {} : { transform: compactTransform }
  };
}

function expandActor(
  compact: CompactSceneActor
): SceneActorJSON {
  return {
    ...compact,
    visible: compact.visible ?? true,
    transform: SceneTransform.create(compact.transform)
  };
}
