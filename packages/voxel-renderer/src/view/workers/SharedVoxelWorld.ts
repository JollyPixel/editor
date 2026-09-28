// Import Internal Dependencies
import type { VoxelCoord } from "../../document/world/types.ts";
import type {
  MeshableLayer,
  MeshableLayerChunk,
  MeshableWorld
} from "../meshing/types.ts";
import type {
  MeshBuildRequest,
  MeshWorkerLayer
} from "./protocol.ts";
import { SharedVoxelChunk } from "./SharedVoxelChunk.ts";

export class SharedVoxelLayer implements MeshableLayer {
  readonly visible = true;
  readonly compositing: "replace" | "composite";
  readonly position: Readonly<VoxelCoord>;

  #chunks = new Map<string, SharedVoxelChunk>();

  constructor(
    layer: MeshWorkerLayer,
    chunkSize: number
  ) {
    this.compositing = layer.compositing;
    this.position = layer.position;
    for (const chunk of layer.chunks) {
      this.#chunks.set(
        chunkKey(chunk.cx, chunk.cy, chunk.cz),
        new SharedVoxelChunk(chunk, chunkSize)
      );
    }
  }

  getChunk(
    cx: number,
    cy: number,
    cz: number
  ): SharedVoxelChunk | undefined {
    return this.#chunks.get(chunkKey(cx, cy, cz));
  }
}

export class SharedVoxelWorld implements MeshableWorld {
  chunkSize = 1;

  #layers: SharedVoxelLayer[] = [];

  getLayers(): readonly SharedVoxelLayer[] {
    return this.#layers;
  }

  load(
    request: MeshBuildRequest
  ): MeshableLayerChunk[] {
    const { chunkSize } = request;
    this.chunkSize = chunkSize;
    this.#layers = request.layers.map(
      (layer) => new SharedVoxelLayer(layer, chunkSize)
    );

    const members: MeshableLayerChunk[] = [];
    for (const { layer: index, cx, cy, cz } of request.members) {
      const layer = this.#layers[index];
      const chunk = layer?.getChunk(cx, cy, cz);
      if (chunk !== undefined) {
        members.push({ layer, chunk });
      }
    }

    return members;
  }
}

function chunkKey(
  cx: number,
  cy: number,
  cz: number
): string {
  return `${cx},${cy},${cz}`;
}
