// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import type { GolemSession } from "../GolemSession.ts";
import { jsonResult } from "./results.ts";
import { ASSET_ID_FIELD } from "./asset.ts";

// CONSTANTS
const kVector = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const kComponentSpec = z.object({
  type: z.string()
    .describe("Camera, Light, Model, …: read a scene to see what exists."),
  data: z.record(z.string(), z.json())
    .optional()
    .describe("The component's settings. Default {}."),
  assets: z.record(
    z.string(),
    z.union([
      z.string(),
      z.object({
        id: z.string(),
        kind: z.string()
      })
    ]).nullable()
  )
    .optional()
    .describe("Asset slots, such as { \"model\": \"models/tree.obj\" }: " +
      "an asset id or catalog path. Default {}.")
});

const kTransformPatch = z.object({
  position: kVector.optional(),
  rotation: kVector.optional()
    .describe("Euler angles in degrees."),
  scale: kVector.optional()
});

const kActorRef = z.string()
  .describe("An actor name or id. A name shared by several actors fails " +
    "with their ids.");

const kActorSpec = z.object({
  name: z.string(),
  visible: z.boolean()
    .optional()
    .describe("Default true."),
  transform: kTransformPatch
    .optional()
    .describe("y is up. Missing fields: position and rotation 0, scale 1."),
  components: z.array(kComponentSpec).optional(),
  get children() {
    return z.array(kActorSpec)
      .optional()
      .describe("Actors added under this one.");
  }
});

export function registerSceneTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "scene_add_actors",
    {
      description: "Add actors, with their children and components, to a " +
        "scene, and wait until the studio accepts them. New actors get " +
        "fresh ids: the result lists every one as { id, name }, parents " +
        "before their children.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        parentId: kActorRef
          .nullable()
          .optional()
          .describe("The actor name or id to add under. Default: the scene root."),
        actors: z.array(kActorSpec)
      })
    },
    async({ assetId, parentId, actors }) => {
      const scene = await session.open(assetId, "scene");
      const added = await scene.addActors(actors, { parentId });
      await scene.settled();

      return jsonResult({
        assetId,
        actors: added
      });
    }
  );

  server.registerTool(
    "scene_transform_actors",
    {
      description: "Change the position, rotation or scale of actors, " +
        "relative to their parent, and wait until the studio accepts it. " +
        "Fields left out keep their value.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        changes: z.array(z.object({
          actor: kActorRef,
          transform: kTransformPatch
        }))
      })
    },
    async({ assetId, changes }) => {
      const scene = await session.open(assetId, "scene");
      await scene.transformActors(changes);
      await scene.settled();

      return jsonResult({
        assetId,
        transformed: changes.length
      });
    }
  );

  server.registerTool(
    "scene_move_actors",
    {
      description: "Move actors under another parent, in the given order, " +
        "and wait until the studio accepts it. Each actor keeps its " +
        "transform, which is relative to its parent: transform it after " +
        "when the new parent is placed elsewhere.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        actors: z.array(kActorRef),
        parent: kActorRef.nullable()
          .describe("The new parent's name or id, null for the scene root."),
        before: kActorRef.optional()
          .describe("The child they go before. Default: after the last child.")
      })
    },
    async({ assetId, actors, parent, before }) => {
      const scene = await session.open(assetId, "scene");
      await scene.moveActors(actors, { parent, before });
      await scene.settled();

      return jsonResult({
        assetId,
        moved: actors.length
      });
    }
  );

  server.registerTool(
    "scene_remove_actors",
    {
      description: "Remove actors with their children, and wait until the " +
        "studio accepts it.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        actors: z.array(kActorRef)
      })
    },
    async({ assetId, actors }) => {
      const scene = await session.open(assetId, "scene");
      await scene.removeActors(actors);
      await scene.settled();

      return jsonResult({
        assetId,
        removed: actors.length
      });
    }
  );

  server.registerTool(
    "scene_add_components",
    {
      description: "Add components to an actor, and wait until the studio " +
        "accepts them. The result lists the new components as { id, type }.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        actor: kActorRef,
        components: z.array(kComponentSpec)
      })
    },
    async({ assetId, actor, components }) => {
      const scene = await session.open(assetId, "scene");
      const added = await scene.addComponents(actor, components);
      await scene.settled();

      return jsonResult({
        assetId,
        components: added
      });
    }
  );
}
