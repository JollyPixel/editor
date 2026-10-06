// Import Internal Dependencies
import { BlockRegistry } from "../../document/blocks/BlockRegistry.ts";
import { BlockShapeRegistry } from "../../document/blocks/shape/BlockShapeRegistry.ts";
import { BlendGroupList } from "../../document/materials/BlendGroupList.ts";
import type { VoxelLogger } from "../../VoxelLogger.ts";
import { VoxelMeshBuilder } from "../meshing/VoxelMeshBuilder.ts";
import { FaceTemplateTable } from "../meshing/pulling/FaceTemplateTable.ts";
import { FaceRegionTable } from "../meshing/pulling/FaceRegionTable.ts";
import { DefinedShape } from "./DefinedShape.ts";
import { DefinedBlocksets } from "./DefinedBlocksets.ts";
import type { MeshDefinitions } from "./MeshDefinitions.ts";
import type {
  MeshBuildRequest,
  MeshWorkerGeometry,
  MeshWorkerScope
} from "./protocol.ts";
import { SharedVoxelWorld } from "./SharedVoxelWorld.ts";

export function runMeshWorker(
  scope: MeshWorkerScope
): void {
  const world = new SharedVoxelWorld();
  const logger = forwardingLogger(scope);
  let builder: VoxelMeshBuilder | null = null;

  scope.addEventListener("message", ({ data: request }) => {
    if (request.type === "definitions") {
      builder = createBuilder(request.definitions, world, logger);

      return;
    }

    try {
      if (builder === null) {
        throw new Error("Mesh worker received a build before its definitions.");
      }
      build(scope, builder, world, request);
    }
    catch (error) {
      scope.postMessage({
        type: "failed",
        id: request.id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

function build(
  scope: MeshWorkerScope,
  builder: VoxelMeshBuilder,
  world: SharedVoxelWorld,
  request: MeshBuildRequest
): void {
  builder.ambientOcclusion = request.ambientOcclusion;

  const knownTemplates = builder.faceTemplates.count;
  const members = world.load(request);
  const geometries: MeshWorkerGeometry[] = [];
  const transfer: ArrayBuffer[] = [];
  for (const [key, data] of builder.buildChunkMeshData(members)) {
    const { alphaMode, side, alphaCutoff, materialGroup } = key.surface;
    geometries.push({
      blocksetId: key.blocksetId,
      surface: {
        alphaMode,
        side,
        alphaCutoff,
        materialGroup
      },
      blended: key.blended,
      data
    });
    transfer.push(data.words.buffer);
    if (data.blendPalette !== undefined) {
      transfer.push(data.blendPalette.buffer);
    }
  }

  scope.postMessage(
    {
      type: "built",
      id: request.id,
      geometries,
      stats: builder.stats.toJSON(),
      templates: builder.faceTemplates.templatesSince(knownTemplates)
    },
    { transfer }
  );
}

function createBuilder(
  definitions: MeshDefinitions,
  world: SharedVoxelWorld,
  logger: VoxelLogger
): VoxelMeshBuilder {
  return new VoxelMeshBuilder({
    world,
    blockRegistry: new BlockRegistry(definitions.blocks),
    shapeRegistry: new BlockShapeRegistry().registerMany(
      definitions.shapes.map((shape) => new DefinedShape(shape))
    ),
    atlases: new DefinedBlocksets(definitions.blocksets),
    blendGroups: new BlendGroupList(definitions.blendGroups),
    alphaTest: definitions.alphaTest,
    faceTemplates: new FaceTemplateTable(
      new FaceRegionTable(definitions.regions)
    ),
    logger
  });
}

function forwardingLogger(
  scope: MeshWorkerScope
): VoxelLogger {
  const logger: VoxelLogger = {
    child() {
      return logger;
    },
    debug() {
      return;
    },
    warn(message, meta) {
      scope.postMessage({ type: "log", level: "warn", message, meta });
    },
    error(message, meta) {
      scope.postMessage({ type: "log", level: "error", message, meta });
    }
  };

  return logger;
}
