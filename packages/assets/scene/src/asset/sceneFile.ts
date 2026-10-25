// Import Third-party Dependencies
import {
  describeErrors,
  SchemaParser,
  type Infer
} from "@jolly-pixel/network";
import { InvalidAssetFileError } from "@jolly-pixel/asset-server";
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
  SCENE_KIND,
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

const kFileParser = new SchemaParser(compactSceneFileSchema);

export type CompactSceneFile = Infer<typeof compactSceneFileSchema>;
type CompactSceneActor = CompactSceneFile["actors"][number];

export function encodeSceneFile(
  file: SceneFile
): Uint8Array {
  const compact: CompactSceneFile = {
    ...file,
    actors: file.actors.map(compactActor)
  };

  return new TextEncoder().encode(JSON.stringify(compact));
}

export function decodeSceneFile(
  content: Uint8Array
): SceneFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidAssetFileError(
      SCENE_KIND,
      "content is not JSON",
      { cause: error }
    );
  }

  const result = kFileParser.parse(parsed);
  if (result.err) {
    throw new InvalidAssetFileError(
      SCENE_KIND,
      describeErrors(result.val)
    );
  }

  return {
    ...result.val,
    actors: result.val.actors.map(expandActor)
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
