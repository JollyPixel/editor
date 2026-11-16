// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import { SceneTransform } from "../model/changes/SceneTransform.ts";
import {
  sceneActorSchema,
  sceneEnvironmentSchema,
  sceneTransformSchema
} from "../network/SceneCommand.schema.ts";
import type {
  SceneActorJSON,
  SceneEnvironmentJSON
} from "../network/types.ts";
import {
  SCENE_FILE_VERSION,
  type SceneFile
} from "./scene.ts";

// CONSTANTS
const kCompactActorSchema = z.extend(sceneActorSchema, {
  visible: z.optional(z.boolean()),
  transform: z.optional(z.partial(sceneTransformSchema))
});

const kInlineEnvironmentSchema = z.object({
  fog: z.unknown()
});

export const compactSceneFileSchema = z.object({
  version: z.literal(SCENE_FILE_VERSION),
  environment: z.optional(
    z.union([sceneEnvironmentSchema, kInlineEnvironmentSchema])
  ),
  actors: z.array(kCompactActorSchema)
});

export type CompactSceneFile = Infer<typeof compactSceneFileSchema>;
type CompactSceneActor = CompactSceneFile["actors"][number];

export function compactSceneFile(
  file: SceneFile
): CompactSceneFile {
  const { environment, ...rest } = file;

  return {
    ...rest,
    ...environment === null ? {} : { environment },
    actors: file.actors.map(compactActor)
  };
}

export function expandSceneFile(
  compact: CompactSceneFile
): SceneFile {
  return {
    ...compact,
    environment: expandEnvironment(compact.environment),
    actors: compact.actors.map(expandActor)
  };
}

function expandEnvironment(
  environment: CompactSceneFile["environment"]
): SceneEnvironmentJSON {
  return environment !== undefined && environment !== null && "id" in environment ?
    environment :
    null;
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
