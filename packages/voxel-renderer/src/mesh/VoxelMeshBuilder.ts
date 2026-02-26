// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { VoxelWorld } from "../world/VoxelWorld.ts";
import type { VoxelChunk } from "../world/VoxelChunk.ts";
import type { VoxelLayer } from "../world/VoxelLayer.ts";
import type { BlockRegistry } from "../blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../blocks/BlockShapeRegistry.ts";
import type { TilesetManager } from "../tileset/TilesetManager.ts";
import {
  unpackTransform,
  type FACE
} from "../utils/math.ts";
import {
  FACE_OFFSETS,
  FACE_OPPOSITE,
  rotateFace,
  rotateVertex,
  rotateNormal,
  flipYFace
} from "./math.ts";
import type { VoxelEntry } from "../world/types.ts";

export interface VoxelMeshBuilderOptions {
  world: VoxelWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
}

interface TilesetBuffer {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  vertexOffset: number;
}

/**
 * Builds per-tileset THREE.BufferGeometries for one chunk using naive face culling.
 *
 * Algorithm: for each filled voxel, emit only the faces where the adjacent
 * voxel in the face's direction either does not exist or does not occlude.
 * Non-axis-aligned faces (slopes, corners) correctly rotate their culling
 * direction via rotateFace() before the neighbour lookup.
 *
 * Voxels at a position already occupied by a higher-priority layer are skipped
 * entirely (the higher layer's chunk will render that position instead).
 *
 * Geometry is split by tileset so each resulting mesh can be assigned the
 * correct material/texture when multiple tilesets are in use.
 *
 * Greedy meshing is intentionally omitted: it is incompatible with per-face UV
 * rotation and the non-cube shapes supported by this renderer.
 */
export class VoxelMeshBuilder {
  #world: VoxelWorld;
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;
  #tilesetManager: TilesetManager;

  constructor(
    options: VoxelMeshBuilderOptions
  ) {
    this.#world = options.world;
    this.#blockRegistry = options.blockRegistry;
    this.#shapeRegistry = options.shapeRegistry;
    this.#tilesetManager = options.tilesetManager;
  }

  /**
   * Builds merged BufferGeometries for one chunk, grouped by tileset ID.
   * Returns null if the chunk is empty or produces no visible faces.
   *
   * Each entry in the returned Map is a separate geometry containing only the
   * faces whose tile references belong to that tileset, allowing the caller to
   * bind the correct texture per draw call.
   */
  buildChunkGeometries(
    chunk: VoxelChunk,
    layer: VoxelLayer
  ): Map<string, THREE.BufferGeometry> | null {
    // No tileset registered yet — cannot compute UVs. Return null so the
    // caller skips mesh creation; loadTileset() will mark chunks dirty and
    // trigger a rebuild once the texture is available.
    if (this.#tilesetManager.defaultTilesetId === null) {
      return null;
    }

    const tilesetBuffers = new Map<string, TilesetBuffer>();

    const worldOriginX = chunk.cx * this.#world.chunkSize + layer.offset.x;
    const worldOriginY = chunk.cy * this.#world.chunkSize + layer.offset.y;
    const worldOriginZ = chunk.cz * this.#world.chunkSize + layer.offset.z;

    for (const [linearIdx, entry] of chunk.entries()) {
      const { lx, ly, lz } = chunk.fromLinearIndex(linearIdx);
      const wx = worldOriginX + lx;
      const wy = worldOriginY + ly;
      const wz = worldOriginZ + lz;

      // Skip if a higher-priority layer already occupies this position.
      // world.getVoxelAt() returns the composited (highest-order) entry at
      // this position; if it is a different object than our chunk's entry,
      // another layer will render this voxel instead.
      const compositedEntry = this.#world.getVoxelAt({ x: wx, y: wy, z: wz });
      if (compositedEntry !== entry) {
        continue;
      }

      const blockDef = this.#blockRegistry.get(entry.blockId);
      if (!blockDef) {
        continue;
      }

      const shape = this.#shapeRegistry.get(blockDef.shapeId);
      if (!shape) {
        continue;
      }

      const { rotation, flipX, flipZ, flipY } = unpackTransform(entry.transform);

      for (const faceDef of shape.faces) {
        // Rotate the logical face direction to find the world-space neighbour.
        let worldFace = rotateFace(faceDef.face, rotation);
        if (flipY && worldFace !== undefined) {
          worldFace = flipYFace(worldFace);
        }

        // worldFace is undefined when faceDef.face is the sentinel value 6
        // (used by Stair/RampCorner shapes to mark "always emit" faces).
        // In that case skip neighbour culling entirely.
        if (worldFace !== undefined) {
          const offset = FACE_OFFSETS[worldFace];
          const nx = wx + offset[0];
          const ny = wy + offset[1];
          const nz = wz + offset[2];

          // Check whether the neighbour blocks this face.
          // We always query the world (not just the chunk) so cross-chunk culling
          // is handled transparently.
          const neighbourEntry = this.#world.getVoxelAt({
            x: nx,
            y: ny,
            z: nz
          });
          if (this.#isNeighbourFaceHidden(neighbourEntry, worldFace)) {
            continue;
          }
        }

        // Resolve the tile reference for this face.
        const tileRef = blockDef.faceTextures[faceDef.face] ?? blockDef.defaultTexture;
        if (!tileRef) {
          // No texture configured — skip.
          continue;
        }

        const tilesetId = tileRef.tilesetId ?? this.#tilesetManager.defaultTilesetId!;
        let buf = tilesetBuffers.get(tilesetId);
        if (!buf) {
          buf = {
            positions: [],
            normals: [],
            uvs: [],
            indices: [],
            vertexOffset: 0
          };
          tilesetBuffers.set(tilesetId, buf);
        }

        const uvRegion = this.#tilesetManager.getTileUV(tileRef);

        // Transform each vertex and emit position / normal / uv.
        // When flipY is active, iterate vertices in reverse order to fix winding.
        const faceVertCount = faceDef.vertices.length;
        for (let i = 0; i < faceVertCount; i++) {
          const vi = flipY ? (faceVertCount - 1 - i) : i;
          const localVert = faceDef.vertices[vi];
          const transformed = rotateVertex(
            localVert,
            rotation,
            { x: flipX, z: flipZ, y: flipY }
          );

          buf.positions.push(
            wx + transformed[0],
            wy + transformed[1],
            wz + transformed[2]
          );

          // Rotate the surface normal as well (only Y and horizontal components).
          const rotatedNormal = rotateNormal(
            faceDef.normal,
            rotation,
            { flipX, flipZ, flipY }
          );
          buf.normals.push(rotatedNormal[0], rotatedNormal[1], rotatedNormal[2]);

          const tileUV = faceDef.uvs[vi];
          buf.uvs.push(
            uvRegion.offsetU + (uvRegion.scaleU * tileUV[0]),
            uvRegion.offsetV + (uvRegion.scaleV * tileUV[1])
          );
        }

        // Triangulate via fan from vertex 0: [0,1,2] and (if quad) [0,2,3].
        const base = buf.vertexOffset;
        buf.indices.push(base, base + 1, base + 2);
        if (faceVertCount === 4) {
          buf.indices.push(base, base + 2, base + 3);
        }
        buf.vertexOffset += faceVertCount;
      }
    }

    if (tilesetBuffers.size === 0) {
      return null;
    }

    const result = new Map<string, THREE.BufferGeometry>();
    for (const [tilesetId, buf] of tilesetBuffers) {
      if (buf.positions.length === 0) {
        continue;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(buf.positions, 3)
      );
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(buf.normals, 3)
      );
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(buf.uvs, 2)
      );
      geometry.setIndex(buf.indices);

      result.set(tilesetId, geometry);
    }

    return result.size > 0 ? result : null;
  }

  /**
   * Returns true if the neighbour voxel exists and
   * its shape occludes the face that points back toward this voxel.
    * Returns false if the neighbour is empty or its shape does not occlude that face.
   */
  #isNeighbourFaceHidden(
    neighbourEntry: VoxelEntry | undefined,
    worldFace: FACE
  ): boolean {
    if (neighbourEntry === undefined) {
      // No neighbour — face is visible.
      return false;
    }

    const neighbourDef = this.#blockRegistry.get(neighbourEntry.blockId);
    if (neighbourDef) {
      const neighbourShape = this.#shapeRegistry.get(neighbourDef.shapeId);
      if (!neighbourShape) {
        // Neighbour has no shape — treat as non-occluding.
        return false;
      }

      const oppFace = FACE_OPPOSITE[worldFace];
      const {
        rotation: neighbourRotation,
        flipY: neighbourFlipY
      } = unpackTransform(neighbourEntry.transform);

      // oppFace is in world space; convert to the neighbour's local space using
      // the INVERSE rotation (rotateFace is forward: local→world, so inverse is
      // (4 - rotation) % 4 for discrete 90° Y steps).
      let rotatedOppFace = rotateFace(oppFace, (4 - neighbourRotation) % 4);
      if (neighbourFlipY) {
        rotatedOppFace = flipYFace(rotatedOppFace);
      }

      if (neighbourShape.occludes(rotatedOppFace)) {
        // Face is hidden — skip emission.
        return true;
      }
    }

    return false;
  }
}
