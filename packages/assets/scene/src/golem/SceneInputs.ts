// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  actorSpecSchema,
  componentSpecSchema,
  transformPatchSchema
} from "./ActorSpec.ts";

// CONSTANTS
const kActorRef = z.string().check(z.describe("An actor name or id. A name " +
  "shared by several actors fails with their ids."));

export const addActorsInputSchema = z.object({
  parentId: z.optional(z.nullable(kActorRef).check(
    z.describe("The actor name or id to add under. Default: the scene root.")
  )),
  actors: z.array(actorSpecSchema)
});

export const transformActorsInputSchema = z.object({
  changes: z.array(z.object({
    actor: kActorRef,
    transform: transformPatchSchema
  }))
});

export const moveActorsInputSchema = z.object({
  actors: z.array(kActorRef),
  parent: z.nullable(kActorRef).check(
    z.describe("The new parent's name or id, null for the scene root.")
  ),
  before: z.optional(kActorRef.check(
    z.describe("The child they go before. Default: after the last child.")
  ))
});

export const removeActorsInputSchema = z.object({
  actors: z.array(kActorRef)
});

export const addComponentsInputSchema = z.object({
  actor: kActorRef,
  components: z.array(componentSpecSchema)
});

export const useEnvironmentInputSchema = z.object({
  environment: z.nullable(z.string()).check(z.describe(
    "An environment asset id or catalog path; null for the default environment."
  ))
});

export type AddActorsInput = z.output<typeof addActorsInputSchema>;

export type TransformActorsInput = z.output<typeof transformActorsInputSchema>;

export type MoveActorsInput = z.output<typeof moveActorsInputSchema>;

export type RemoveActorsInput = z.output<typeof removeActorsInputSchema>;

export type AddComponentsInput = z.output<typeof addComponentsInputSchema>;

export type UseEnvironmentInput = z.output<typeof useEnvironmentInputSchema>;
