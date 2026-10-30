// Import Third-party Dependencies
import {
  commandVariant,
  MessageProtocol,
  minProperties,
  withCommandHeader
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { JSONValue } from "./types.ts";

// CONSTANTS
const kIdSchema = z.string().check(z.minLength(1));
const kNullableIdSchema = z.nullable(kIdSchema);
const kBeforeIdSchema = z.optional(kIdSchema);
const kPathSchema = z.string().check(z.regex(/^[^/]+(?:\/[^/]+)*$/));
const kHexColorSchema = z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/));

const kJSONValueSchema: z.ZodMiniType<JSONValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(kJSONValueSchema),
  z.record(z.string(), kJSONValueSchema)
]));

export const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const kTransformShape = {
  position: vector3Schema,
  rotation: vector3Schema,
  scale: vector3Schema
};

export const sceneTransformSchema = z.object(kTransformShape);

export const sceneTransformPatchSchema = minProperties(
  z.partial(z.strictObject(kTransformShape)),
  1
);

export const assetReferenceSchema = z.object({
  id: kIdSchema,
  kind: z.string()
});

export const sceneAnchorSchema = z.object({
  component: kIdSchema,
  key: kIdSchema
});

export const componentDataSchema = z.record(z.string(), kJSONValueSchema);

export const componentAssetsSchema = z.record(
  z.string(),
  z.nullable(assetReferenceSchema)
);

export const sceneComponentSchema = z.object({
  id: kIdSchema,
  type: z.string().check(z.minLength(1)),
  data: componentDataSchema,
  assets: componentAssetsSchema
});

const kActorOverrideFieldSchema = z.keyof(z.object({
  name: z.string(),
  visible: z.boolean(),
  ...kTransformShape
}));

export const sceneActorOverrideSchema = z.strictObject({
  name: z.optional(z.string()),
  visible: z.optional(z.boolean()),
  transform: z.optional(z.partial(z.strictObject(kTransformShape)))
});

export const sceneComponentOverrideSchema = z.strictObject({
  data: z.optional(componentDataSchema),
  assets: z.optional(componentAssetsSchema)
});

export const sceneOverridesSchema = z.strictObject({
  actors: z.optional(z.record(kPathSchema, sceneActorOverrideSchema)),
  components: z.optional(z.record(kPathSchema, sceneComponentOverrideSchema))
});

export const sceneActorSchema = z.object({
  id: kIdSchema,
  name: z.string(),
  parentId: kNullableIdSchema,
  visible: z.boolean(),
  transform: sceneTransformSchema,
  components: z.array(sceneComponentSchema),
  prefab: z.optional(assetReferenceSchema),
  overrides: z.optional(sceneOverridesSchema),
  anchor: z.optional(sceneAnchorSchema)
});

export const sceneFogSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("none")
  }),
  z.object({
    kind: z.literal("linear"),
    color: kHexColorSchema,
    near: z.number().check(z.minimum(0)),
    far: z.number().check(z.minimum(0))
  }),
  z.object({
    kind: z.literal("exp2"),
    color: kHexColorSchema,
    density: z.number().check(z.minimum(0))
  })
]);

const kEnvironmentShape = {
  background: z.nullable(kHexColorSchema),
  environment: z.object({
    kind: z.enum(["none", "room"]),
    intensity: z.number().check(z.minimum(0))
  }),
  fog: sceneFogSchema
};

export const sceneEnvironmentSchema = z.object(kEnvironmentShape);

export const sceneEnvironmentPatchSchema = minProperties(
  z.partial(z.strictObject(kEnvironmentShape)),
  1
);

export const sceneSnapshotSchema = z.object({
  environment: sceneEnvironmentSchema,
  actors: z.array(sceneActorSchema)
});

export const sceneCommandSchema = z.discriminatedUnion("action", [
  commandVariant("actor-added", {
    actors: z.array(sceneActorSchema).check(z.minLength(1)),
    beforeId: kBeforeIdSchema
  }),
  commandVariant("actor-removed", {
    id: kIdSchema
  }),
  commandVariant("actor-moved", {
    id: kIdSchema,
    parentId: kNullableIdSchema,
    transform: sceneTransformSchema,
    anchor: z.optional(sceneAnchorSchema),
    beforeId: kBeforeIdSchema
  }),
  commandVariant("actor-renamed", {
    id: kIdSchema,
    name: z.string()
  }),
  commandVariant("actor-visibility", {
    id: kIdSchema,
    visible: z.boolean()
  }),
  commandVariant("actor-transformed", {
    id: kIdSchema,
    transform: sceneTransformPatchSchema
  }),
  commandVariant("component-added", {
    actorId: kIdSchema,
    component: sceneComponentSchema,
    beforeId: kBeforeIdSchema
  }),
  commandVariant("component-removed", {
    actorId: kIdSchema,
    id: kIdSchema
  }),
  commandVariant("component-moved", {
    actorId: kIdSchema,
    id: kIdSchema,
    beforeId: kBeforeIdSchema
  }),
  commandVariant("component-changed", {
    id: kIdSchema,
    data: componentDataSchema,
    unset: z.optional(z.array(z.string()))
  }),
  commandVariant("component-assets-changed", {
    id: kIdSchema,
    assets: minProperties(componentAssetsSchema, 1)
  }),
  commandVariant("actor-overridden", {
    id: kIdSchema,
    path: kPathSchema,
    set: z.optional(sceneActorOverrideSchema),
    unset: z.optional(z.array(kActorOverrideFieldSchema))
  }),
  commandVariant("component-overridden", {
    id: kIdSchema,
    path: kPathSchema,
    set: z.optional(sceneComponentOverrideSchema),
    unset: z.optional(z.strictObject({
      data: z.optional(z.array(z.string())),
      assets: z.optional(z.array(z.string()))
    }))
  }),
  commandVariant("environment-changed", {
    environment: sceneEnvironmentPatchSchema
  })
]);

export const sceneCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(sceneCommandSchema.def.options.map(withCommandHeader))
);
