// Import Internal Dependencies
import type { BlockRegistry } from "../../../document/blocks/BlockRegistry.ts";
import type { BlockShape } from "../../../document/blocks/shape/BlockShape.ts";
import type {
  BlockShapeRegistry
} from "../../../document/blocks/shape/BlockShapeRegistry.ts";
import type {
  TileRotation,
  AtlasUVRegion
} from "../../../document/blocksets/types.ts";
import { rotateTileUv } from "../../../document/blocksets/tileRef.ts";
import type { FaceDefinition } from "../../../document/blocks/face/index.ts";
import { BlockTextures } from "../../../document/blocks/BlockTextures.ts";
import { BlockSurface } from "../../../document/blocks/BlockSurface.ts";
import type { BlendGroupList } from "../../../document/materials/BlendGroupList.ts";
import type { BlendGroup } from "../../../document/materials/BlendGroup.ts";
import type { FaceBlendMatch } from "../faceBlend.ts";
import {
  cullsCoveredFaces,
  type ResolvedBlockDefinition
} from "../../../document/blocks/BlockDefinition.ts";
import {
  shapeSlots,
  unknownTextureSlots,
  type ShapeSlot
} from "../../../document/blocks/shape/shapeSlots.ts";
import type {
  BlockVariant,
  BlockVariantFace,
  MergedVariant,
  MergedVariantPart,
  BlocksetResolver,
  AtlasUvSource
} from "./types.ts";
import { BlockComplements } from "../../../document/blocks/BlockComplements.ts";
import {
  voxelBlockId,
  voxelTransform,
  type PackedVoxel
} from "../../../document/world/storage/packedVoxel.ts";
import { unmarkMerged } from "../../../document/world/storage/mergedVoxel.ts";
import { ChunkGeometryKey } from "../ChunkGeometryKey.ts";
import { FACES, FACE_OPPOSITE } from "../../../document/geometry/faceDirection.ts";
import { splitBoundaryFace } from "../neighbourhood/splitBoundaryFace.ts";
import { isFullQuad } from "./fullQuad.ts";
import {
  tileUvOf,
  type TileUv
} from "./tileUv.ts";
import { FaceRegionTable } from "../pulling/FaceRegionTable.ts";
import {
  transformFace,
  rotateVertex,
  rotateNormal,
  mirrorsWinding
} from "../../../document/geometry/rotation.ts";
import {
  toSnorm8,
  toUnorm16
} from "./quantize.ts";
import {
  VoxelTransform,
  VOXEL_TRANSFORM_MASK
} from "../../../document/geometry/VoxelTransform.ts";
import {
  NOOP_LOGGER,
  type VoxelLogger
} from "../../../VoxelLogger.ts";

/*
 * CONSTANTS
 * A packed transform uses bits 0-4, so a block has at most 32 variants.
 */
const kTransformCount = VOXEL_TRANSFORM_MASK + 1;
const kOcclusionUnknown = -1;
/**
 * Caps the flat occlusion table at 64k slots; higher IDs use the map.
 */
const kOcclusionMaxSlots = 1 << 16;
const kOcclusionFaceMask = 0b111111;
const kNoBlock = -1;
const kSelfOcclusionShift = 6;

interface CompileFaceOptions {
  faceDef: FaceDefinition;
  uvRegion: AtlasUVRegion;
  regionId: number;
  tileRotation?: TileRotation;
  blocksetId: string;
  surface: BlockSurface;
  voxelTransform: VoxelTransform;
}

export interface BlockVariantCacheOptions {
  alphaTest?: number;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
  atlases: BlocksetResolver;
  blendGroups?: BlendGroupList;
  /**
   * Receives a warning for each `faceTextures` key no slot of the block's
   * shape can use.
   */
  logger?: VoxelLogger;
  regions?: FaceRegionTable;
}

interface SlotTile {
  textureSlot: ShapeSlot;
  atlas: AtlasUvSource;
  tile: TileUv;
  regionId: number;
}

interface ResolvedTiles {
  tiles: SlotTile[];
  pending: boolean;
}

/**
 * Memoizes transformed geometry and atlas UVs by block and transform.
 */
export class BlockVariantCache {
  #blockRegistry: BlockRegistry;
  #shapeRegistry: BlockShapeRegistry;
  #atlases: BlocksetResolver;
  #regions: FaceRegionTable;
  #blendGroups: BlendGroupList | undefined;
  #alphaTest: number;
  #logger: VoxelLogger;
  #checkedSlots = new WeakMap<ResolvedBlockDefinition, BlockShape>();
  #complements: BlockComplements;

  #variants = new Map<number, BlockVariant | null>();
  #merged = new Map<PackedVoxel, Map<PackedVoxel, MergedVariant | null>>();
  #slots = new Map<string, number>();
  #geometryKeys: ChunkGeometryKey[] = [];
  #frontSlots: number[] = [];
  #blendedSlots: number[] = [];
  #variantTable: (BlockVariant | null | undefined)[] = [];
  #blendMatches = new WeakMap<
    BlockVariantFace,
    Map<BlockVariant, FaceBlendMatch | null>
  >();
  #frontFaces = new WeakMap<BlockVariantFace, BlockVariantFace>();
  #faceCoverage = new WeakMap<
    BlockVariantFace,
    WeakMap<BlockVariant, boolean>
  >();

  /**
   * Flat occlusion cache indexed by block and transform.
   */
  #occlusion = new Int32Array(0);

  #blockVersion = -1;
  #shapeVersion = -1;
  #blocksetVersion = -1;
  #blendVersion = -1;

  constructor(
    options: BlockVariantCacheOptions
  ) {
    this.#blockRegistry = options.blockRegistry;
    this.#shapeRegistry = options.shapeRegistry;
    this.#atlases = options.atlases;
    this.#regions = options.regions ?? new FaceRegionTable();
    this.#blendGroups = options.blendGroups;
    this.#alphaTest = options.alphaTest ?? 0.1;
    this.#logger = options.logger ?? NOOP_LOGGER;
    this.#complements = new BlockComplements({
      blocks: this.#blockRegistry,
      shapes: this.#shapeRegistry
    });
  }

  refresh(): void {
    const blockVersion = this.#blockRegistry.version;
    const shapeVersion = this.#shapeRegistry.version;
    const blocksetVersion = this.#atlases.version;
    const blendVersion = this.#blendGroups?.version ?? 0;

    if (
      blockVersion === this.#blockVersion &&
      shapeVersion === this.#shapeVersion &&
      blocksetVersion === this.#blocksetVersion &&
      blendVersion === this.#blendVersion
    ) {
      return;
    }

    this.#blockVersion = blockVersion;
    this.#shapeVersion = shapeVersion;
    this.#blocksetVersion = blocksetVersion;
    this.#blendVersion = blendVersion;
    this.#variants.clear();
    this.#merged.clear();
    this.#slots.clear();
    this.#geometryKeys.length = 0;
    this.#frontSlots.length = 0;
    this.#blendedSlots.length = 0;
    this.#frontFaces = new WeakMap();
    this.#faceCoverage = new WeakMap();
    this.#blendMatches = new WeakMap();
    this.#occlusion.fill(kOcclusionUnknown);
    this.#variantTable.fill(undefined);
  }

  /**
   * Returns null when the block or shape is unknown.
   */
  get(
    blockId: number,
    transform: number
  ): BlockVariant | null {
    const key = (blockId * kTransformCount) + (transform & VOXEL_TRANSFORM_MASK);
    if (key >>> 0 < this.#variantTable.length) {
      const cached = this.#variantTable[key];
      if (cached !== undefined) {
        return cached;
      }
    }

    let variant = this.#variants.get(key);
    if (variant === undefined) {
      variant = this.#compile(blockId, transform & VOXEL_TRANSFORM_MASK);
      this.#variants.set(key, variant);
    }
    if (key >= 0 && key < kOcclusionMaxSlots) {
      this.#growVariantTable(key);
      this.#variantTable[key] = variant;
    }

    return variant;
  }

  #growVariantTable(
    key: number
  ): void {
    if (key < this.#variantTable.length) {
      return;
    }

    const grown: (BlockVariant | null | undefined)[] = new Array(
      Math.min(kOcclusionMaxSlots, nextPowerOfTwo(key + 1))
    ).fill(undefined);
    for (let i = 0; i < this.#variantTable.length; i++) {
      grown[i] = this.#variantTable[i];
    }
    this.#variantTable = grown;
  }

  blendMatchOf(
    face: BlockVariantFace,
    group: BlendGroup,
    neighbour: BlockVariant
  ): FaceBlendMatch | null {
    let matches = this.#blendMatches.get(face);
    if (matches === undefined) {
      matches = new Map();
      this.#blendMatches.set(face, matches);
    }

    let match = matches.get(neighbour);
    if (match === undefined) {
      match = this.#compileBlendMatch(face, group, neighbour);
      matches.set(neighbour, match);
    }

    return match;
  }

  #compileBlendMatch(
    face: BlockVariantFace,
    group: BlendGroup,
    neighbour: BlockVariant
  ): FaceBlendMatch | null {
    const neighbourGroup = neighbour.blend;
    if (neighbourGroup === null) {
      return null;
    }

    const strength = neighbourGroup.bleedOnto(group);
    if (strength === 0) {
      return null;
    }

    const { blocksetId } = this.#geometryKeys[face.slot];
    const matching = neighbour.faces.find((candidate) => (
      candidate.cull === face.cull &&
      this.#geometryKeys[candidate.slot].blocksetId === blocksetId
    ));
    if (matching === undefined) {
      return null;
    }

    return {
      face: matching,
      neighbour: {
        region: matching.region,
        group: neighbourGroup,
        strength,
        inverted: strength < 1 && neighbourGroup.id > group.id
      }
    };
  }

  mergedOf(
    packed: PackedVoxel,
    partner: PackedVoxel
  ): MergedVariant | null {
    const primary = unmarkMerged(packed);
    let byPartner = this.#merged.get(primary);
    if (byPartner === undefined) {
      byPartner = new Map();
      this.#merged.set(primary, byPartner);
    }

    let merged = byPartner.get(partner);
    if (merged === undefined) {
      merged = this.#compileMerged(primary, partner);
      byPartner.set(partner, merged);
    }

    return merged;
  }

  #compileMerged(
    packed: PackedVoxel,
    partner: PackedVoxel
  ): MergedVariant | null {
    const variants = [packed, partner]
      .map((part) => this.get(voxelBlockId(part), voxelTransform(part)))
      .filter((variant) => variant !== null);
    if (variants.length < 2) {
      return variants.length === 0 ?
        null :
        {
          parts: [{ variant: variants[0], faces: variants[0].faces }],
          occluder: variants[0]
        };
    }

    const [a, b] = variants;
    const complements = this.#complements.complements(packed, partner);
    const parts: MergedVariantPart[] = [
      {
        variant: a,
        faces: complements ? visibleFaces(a, b) : a.faces
      },
      {
        variant: b,
        faces: complements ? visibleFaces(b, a) : b.faces
      }
    ];
    const opaque = a.surface.occludes && b.surface.occludes;

    return {
      parts,
      occluder: {
        surface: a.surface.occludes ? b.surface : a.surface,
        blockId: a.blockId === b.blockId ? a.blockId : kNoBlock,
        faces: parts.flatMap(
          (part) => part.faces.filter((face) => face.cull >= 0)
        ),
        occlusionMask: complements && opaque ?
          kOcclusionFaceMask :
          a.occlusionMask | b.occlusionMask,
        selfOcclusionMask: complements ?
          kOcclusionFaceMask :
          a.selfOcclusionMask | b.selfOcclusionMask,
        keepsCoveredFaces: a.keepsCoveredFaces || b.keepsCoveredFaces,
        blend: a.blend === b.blend ? a.blend : null
      }
    };
  }

  occlusionMaskOf(
    blockId: number,
    transform: number
  ): number {
    return this.#occlusionEntry(blockId, transform) & kOcclusionFaceMask;
  }

  selfOcclusionMaskOf(
    blockId: number,
    transform: number
  ): number {
    return (this.#occlusionEntry(blockId, transform) >> kSelfOcclusionShift) &
      kOcclusionFaceMask;
  }

  #occlusionEntry(
    blockId: number,
    transform: number
  ): number {
    const key = (blockId * kTransformCount) + (transform & VOXEL_TRANSFORM_MASK);
    /*
     * Unsigned so a negative key (never produced by a packed voxel, but cheap
     * to rule out) misses the table instead of reading `undefined`.
     */
    if (key >>> 0 < this.#occlusion.length) {
      const cached = this.#occlusion[key];
      if (cached !== kOcclusionUnknown) {
        return cached;
      }
    }

    return this.#compileOcclusion(key, blockId, transform);
  }

  #compileOcclusion(
    key: number,
    blockId: number,
    transform: number
  ): number {
    const variant = this.get(blockId, transform);
    const mask = variant === null ?
      0 :
      variant.occlusionMask |
      (variant.selfOcclusionMask << kSelfOcclusionShift);

    if (key >= 0 && key < kOcclusionMaxSlots) {
      if (key >= this.#occlusion.length) {
        const grown = new Int32Array(
          Math.min(kOcclusionMaxSlots, nextPowerOfTwo(key + 1))
        ).fill(kOcclusionUnknown);
        grown.set(this.#occlusion);
        this.#occlusion = grown;
      }
      this.#occlusion[key] = mask;
    }

    return mask;
  }

  geometryKeyAt(
    slot: number
  ): ChunkGeometryKey {
    return this.#geometryKeys[slot];
  }

  frontSlotOf(
    slot: number
  ): number {
    let front = this.#frontSlots[slot];
    if (front === undefined) {
      const key = this.#geometryKeys[slot];
      front = this.#slotFor(key.blocksetId, new BlockSurface({
        ...key.surface,
        side: "front"
      }));
      this.#frontSlots[slot] = front;
    }

    return front;
  }

  blendedSlotOf(
    slot: number
  ): number {
    let blended = this.#blendedSlots[slot];
    if (blended === undefined) {
      const key = this.#geometryKeys[slot];
      blended = this.#slotFor(key.blocksetId, key.surface, true);
      this.#blendedSlots[slot] = blended;
    }

    return blended;
  }

  frontFaceOf(
    face: BlockVariantFace
  ): BlockVariantFace {
    let front = this.#frontFaces.get(face);
    if (front === undefined) {
      front = {
        ...face,
        slot: this.frontSlotOf(face.slot)
      };
      this.#frontFaces.set(face, front);
    }

    return front;
  }

  isFaceCoveredBy(
    face: BlockVariantFace,
    neighbour: BlockVariant
  ): boolean {
    let coverage = this.#faceCoverage.get(face);
    if (coverage === undefined) {
      coverage = new WeakMap();
      this.#faceCoverage.set(face, coverage);
    }

    let covered = coverage.get(neighbour);
    if (covered === undefined) {
      covered = computeFaceCoverage(face, neighbour);
      coverage.set(neighbour, covered);
    }

    return covered;
  }

  #slotFor(
    blocksetId: string,
    surface: BlockSurface,
    blended = false
  ): number {
    const geometryKey = new ChunkGeometryKey(blocksetId, surface, blended);
    const key = geometryKey.toString();

    let slot = this.#slots.get(key);
    if (slot === undefined) {
      slot = this.#geometryKeys.push(geometryKey) - 1;
      this.#slots.set(key, slot);
    }

    return slot;
  }

  #warnUnknownTextureSlots(
    blockDef: ResolvedBlockDefinition,
    shape: BlockShape
  ): void {
    if (this.#checkedSlots.get(blockDef) === shape) {
      return;
    }
    this.#checkedSlots.set(blockDef, shape);

    const unknown = unknownTextureSlots(
      Object.keys(blockDef.faceTextures),
      shape
    );
    if (unknown.length === 0) {
      return;
    }

    const expected = shapeSlots(shape).map((slot) => slot.id).join(", ");
    this.#logger.warn(
      `Block '${blockDef.name}' (#${blockDef.id}) has faceTextures keys ` +
      `matching no slot of shape '${shape.id}': ${unknown.join(", ")}. ` +
      `Expected one of: ${expected}.`,
      {
        blockId: blockDef.id,
        shapeId: shape.id,
        keys: unknown
      }
    );
  }

  writeRegions(
    blockId: number
  ): boolean {
    const blockDef = this.#blockRegistry.get(blockId);
    const shape = blockDef && this.#shapeRegistry.get(blockDef.shapeId);
    if (!blockDef || !shape) {
      return false;
    }

    return !this.#resolveTiles(blockDef, shape).pending;
  }

  #resolveTiles(
    blockDef: ResolvedBlockDefinition,
    shape: BlockShape
  ): ResolvedTiles {
    const textures = BlockTextures.of(blockDef);
    const tiles: SlotTile[] = [];
    let pending = false;
    for (const textureSlot of shapeSlots(shape)) {
      const tileRef = textures.forSlot(textureSlot.id);
      if (!tileRef) {
        continue;
      }

      const atlas = this.#atlases.resolve(tileRef.blocksetId);
      if (!atlas) {
        pending = true;
        continue;
      }

      const tile = tileUvOf(
        atlas,
        tileRef,
        textures.spanFor(textureSlot.id, textureSlot.span)
      );
      const regionId = this.#regions.idOf(blockDef.id, textureSlot.id);
      this.#regions.write(regionId, tile.region);
      tiles.push({
        textureSlot,
        atlas,
        tile,
        regionId
      });
    }

    return {
      tiles,
      pending
    };
  }

  #compile(
    blockId: number,
    transform: number
  ): BlockVariant | null {
    const blockDef = this.#blockRegistry.get(blockId);
    if (!blockDef) {
      return null;
    }

    const shape = this.#shapeRegistry.get(blockDef.shapeId);
    if (!shape) {
      return null;
    }
    this.#warnUnknownTextureSlots(blockDef, shape);

    const surface = new BlockSurface({
      ...blockDef,
      alphaCutoff: blockDef.alphaCutoff ?? this.#alphaTest
    });
    const voxelTransform = VoxelTransform.fromPacked(transform);

    const faces: BlockVariantFace[] = [];
    const { tiles, pending } = this.#resolveTiles(blockDef, shape);
    for (const { textureSlot, atlas, tile, regionId } of tiles) {
      for (const faceDef of textureSlot.definitions) {
        faces.push(
          this.#compileFace({
            faceDef,
            uvRegion: tile.region,
            regionId,
            tileRotation: tile.rotation,
            blocksetId: atlas.def.id,
            surface,
            voxelTransform
          })
        );
      }
    }

    const selfOcclusionMask = pending ?
      0 :
      this.#occlusionMask(shape, voxelTransform);

    return {
      blockId,
      faces,
      occlusionMask: surface.occludes ? selfOcclusionMask : 0,
      selfOcclusionMask,
      keepsCoveredFaces: !cullsCoveredFaces(blockDef),
      surface,
      blend: surface.occludes && blockDef.blendGroup !== undefined ?
        this.#blendGroups?.get(blockDef.blendGroup) ?? null :
        null
    };
  }

  #compileFace(
    options: CompileFaceOptions
  ): BlockVariantFace {
    const {
      faceDef,
      uvRegion,
      regionId,
      tileRotation,
      blocksetId,
      surface,
      voxelTransform
    } = options;

    const cull = faceDef.cull === null ?
      -1 :
      transformFace(faceDef.cull, voxelTransform);
    const mirrored = mirrorsWinding(voxelTransform);

    const vertexCount = faceDef.vertices.length;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Uint16Array(vertexCount * 2);
    const tileUvs = new Float32Array(vertexCount * 2);

    for (let i = 0; i < vertexCount; i++) {
      /*
       * An odd number of flips mirrors the face, so vertices are stored in
       * reverse order to keep the winding (and therefore the front side)
       * correct.
       */
      const vi = mirrored ? vertexCount - 1 - i : i;
      const vertex = rotateVertex(
        faceDef.vertices[vi],
        voxelTransform
      );
      positions[i * 3] = vertex[0];
      positions[(i * 3) + 1] = vertex[1];
      positions[(i * 3) + 2] = vertex[2];

      const tileUV = rotateTileUv(
        faceDef.uvs[vi][0],
        faceDef.uvs[vi][1],
        tileRotation
      );
      tileUvs[i * 2] = tileUV[0];
      tileUvs[(i * 2) + 1] = tileUV[1];
      uvs[i * 2] = toUnorm16(tileUV[0]);
      uvs[(i * 2) + 1] = toUnorm16(tileUV[1]);
    }

    const normal = rotateNormal(
      faceDef.normal,
      voxelTransform
    );

    return {
      cull,
      slot: this.#slotFor(blocksetId, surface),
      vertexCount,
      indexCount: vertexCount === 4 ? 6 : 3,
      positions,
      uvs,
      region: new Uint16Array([
        toUnorm16(Math.fround(uvRegion.offsetU)),
        toUnorm16(Math.fround(uvRegion.offsetV)),
        toUnorm16(Math.fround(uvRegion.scaleU)),
        toUnorm16(Math.fround(uvRegion.scaleV))
      ]),
      regionId,
      full: isFullQuad(cull, positions, tileUvs),
      splittable: cull >= 0 && surface.side !== "front",
      normalX: toSnorm8(normal[0]),
      normalY: toSnorm8(normal[1]),
      normalZ: toSnorm8(normal[2])
    };
  }

  #occlusionMask(
    shape: BlockShape,
    voxelTransform: VoxelTransform
  ): number {
    let mask = 0;
    for (const localFace of FACES) {
      if (shape.occludes(localFace)) {
        mask |= 1 << transformFace(localFace, voxelTransform);
      }
    }

    return mask;
  }
}

function computeFaceCoverage(
  face: BlockVariantFace,
  neighbour: BlockVariant
): boolean {
  const opposite = FACE_OPPOSITE[face.cull];

  let uncovered: BlockVariantFace[] = [face];
  for (const boundary of neighbour.faces) {
    if (boundary.cull !== opposite) {
      continue;
    }

    uncovered = uncovered.flatMap((piece) => splitBoundaryFace({
      face: piece,
      neighbour: boundary,
      frontSlot: piece.slot,
      remove: true
    }));
    if (uncovered.length === 0) {
      return true;
    }
  }

  return false;
}

function nextPowerOfTwo(
  value: number
): number {
  return 2 ** Math.ceil(Math.log2(value));
}

function visibleFaces(
  variant: BlockVariant,
  other: BlockVariant
): readonly BlockVariantFace[] {
  const hidden = other.surface.occludes || other.blockId === variant.blockId;

  return hidden ?
    variant.faces.filter((face) => face.cull >= 0) :
    variant.faces;
}
