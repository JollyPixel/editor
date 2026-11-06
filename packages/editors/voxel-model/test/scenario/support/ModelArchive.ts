// Import Third-party Dependencies
import type { Vector3Like } from "three";
import { AssetPath } from "@jolly-pixel/asset";
import type {
  AssetArchive,
  AssetArchiveAsset
} from "@jolly-pixel/asset-server";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art";
import {
  MaterialSurface,
  VOXEL_MODEL_FILE,
  VOXEL_MODEL_KIND,
  type BlockShapeJSON,
  type MaterialSurfacePatchJSON,
  type MirrorAxes,
  type UVLayoutData,
  type VoxelModelFile
} from "@jolly-pixel/asset.voxel-model";
import {
  VOXEL_ANIMATION_FILE,
  VOXEL_ANIMATION_KIND,
  type AnimationKeyJSON,
  type AnimationTrackJSON
} from "@jolly-pixel/asset.voxel-animation";
import { decodePixelArtFile } from "@jolly-pixel/pixel-draw.renderer";

// CONSTANTS
const kDefaultTransform = {
  position: 0,
  pivotOffset: 0,
  size: 1,
  scale: 1,
  rotation: 0
} as const;
const kDegrees = 180 / Math.PI;

type ModelFileNode = VoxelModelFile["nodes"][number];
type TransformKey = keyof typeof kDefaultTransform;
type KeyChannel = "position" | "rotation" | "scale";

export type ModelTransformRow = Partial<Record<TransformKey, Vector3Like>>;

export interface ModelNodeRow {
  path: string;
  kind: "block" | "folder";
  shape?: BlockShapeJSON;
  transform?: ModelTransformRow;
  flip?: MirrorAxes;
  material?: string;
  uv?: UVLayoutData["state"];
}

export interface ModelMaterialRow {
  name: string;
  surface: MaterialSurfacePatchJSON;
}

export interface ModelKeyRow {
  tick: number;
  value: Vector3Like;
  interpolation?: string;
}

export interface ModelTrackRow {
  path: string;
  keys: Partial<Record<KeyChannel, ModelKeyRow[]>>;
}

export interface ModelClipRow {
  name: string;
  length: number;
  fps: number;
  loop: boolean;
  tracks: ModelTrackRow[];
}

export interface ModelSetRow {
  name: string;
  clips: ModelClipRow[];
}

export interface ModelExpectation {
  nodes: ModelNodeRow[];
  materials: ModelMaterialRow[];
  animations: ModelSetRow[];
  texture: string;
}

export class ModelArchive {
  readonly #archive: AssetArchive;
  readonly #model: VoxelModelFile;

  constructor(
    archive: AssetArchive
  ) {
    const root = archive.assets.find(
      (asset) => asset.id === archive.root?.id
    );
    if (root === undefined || root.kind !== VOXEL_MODEL_KIND) {
      throw new Error("The archive root is not a voxel model.");
    }

    this.#archive = archive;
    this.#model = VOXEL_MODEL_FILE.decode(root.data);
  }

  describe(): ModelExpectation {
    return {
      nodes: this.#nodes(),
      materials: this.#materials(),
      animations: this.#animations(),
      texture: this.#texture()
    };
  }

  #nodes(): ModelNodeRow[] {
    const { nodes, materials } = this.#model;
    const materialNames = new Map(
      materials.map((entry) => [entry.id, entry.name])
    );
    const rows: ModelNodeRow[] = [];

    function visit(
      parentId: string | null,
      prefix: string
    ): void {
      for (const node of nodes) {
        if (node.parentId !== parentId) {
          continue;
        }

        const path = `${prefix}${node.name}`;
        rows.push(nodeRow(path, node, materialNames));
        visit(node.id, `${path}/`);
      }
    }
    visit(null, "");

    return rows;
  }

  #materials(): ModelMaterialRow[] {
    const defaults = new MaterialSurface(MaterialSurface.create());

    return this.#model.materials.flatMap((entry) => {
      if (entry.kind !== "material") {
        return [];
      }

      return [{
        name: entry.name,
        surface: defaults.changesTo(entry.surface)
      }];
    });
  }

  #animations(): ModelSetRow[] {
    return this.#model.animationSets.map((link) => {
      const asset = this.#asset(link.id, VOXEL_ANIMATION_KIND);
      const file = VOXEL_ANIMATION_FILE.decode(asset.data);

      return {
        name: link.own === true ? "own" : assetName(asset),
        clips: file.clips.map((clip) => {
          return {
            name: clip.name,
            length: clip.length,
            fps: clip.fps,
            loop: clip.loop,
            tracks: clip.tracks.map(trackRow)
          };
        })
      };
    });
  }

  #texture(): string {
    const asset = this.#asset(this.#model.texture.id, PIXEL_ART_KIND);
    const { size } = decodePixelArtFile(asset.data);

    return `${size.x}x${size.y}`;
  }

  #asset(
    id: string,
    kind: string
  ): AssetArchiveAsset {
    const asset = this.#archive.assets.find(
      (entry) => entry.id === id && entry.kind === kind
    );
    if (asset === undefined) {
      throw new Error(`The archive holds no ${kind} asset "${id}".`);
    }

    return asset;
  }
}

function nodeRow(
  path: string,
  node: ModelFileNode,
  materialNames: Map<string, string>
): ModelNodeRow {
  if (node.kind === "folder") {
    return {
      path,
      kind: "folder"
    };
  }

  const row: ModelNodeRow = {
    path,
    kind: "block"
  };
  const { shape, flipAxes, materialId, uv } = node;
  if (shape !== undefined && shape.type !== "box") {
    row.shape = shape;
  }
  const transform = transformRow(node.transform);
  if (Object.keys(transform).length > 0) {
    row.transform = transform;
  }
  if (flipAxes !== undefined && (flipAxes.x || flipAxes.y || flipAxes.z)) {
    row.flip = flipAxes;
  }
  if (materialId !== undefined) {
    row.material = materialName(materialNames, materialId);
  }
  if (uv.state !== "unfolded") {
    row.uv = uv.state;
  }

  return row;
}

function materialName(
  materialNames: Map<string, string>,
  id: string
): string {
  const name = materialNames.get(id);
  if (name === undefined) {
    throw new Error(`The model holds no material "${id}".`);
  }

  return name;
}

function transformRow(
  transform: Record<TransformKey, Vector3Like>
): ModelTransformRow {
  const row: ModelTransformRow = {};
  for (const key of Object.keys(kDefaultTransform) as TransformKey[]) {
    const factor = key === "rotation" ? kDegrees : 1;
    const value = rounded(transform[key], factor);
    const fallback = kDefaultTransform[key];
    if (value.x !== fallback || value.y !== fallback || value.z !== fallback) {
      row[key] = value;
    }
  }

  return row;
}

function trackRow(
  track: AnimationTrackJSON
): ModelTrackRow {
  const keys: ModelTrackRow["keys"] = {};
  for (const channel of ["position", "rotation", "scale"] as const) {
    const channelKeys = track[channel];
    if (channelKeys !== undefined && channelKeys.length > 0) {
      keys[channel] = channelKeys.map(keyRow);
    }
  }

  return {
    path: track.path,
    keys
  };
}

function keyRow(
  key: AnimationKeyJSON
): ModelKeyRow {
  return {
    tick: key.tick,
    value: rounded(key.value),
    ...(key.interpolation === "linear" ? {} : {
      interpolation: key.interpolation
    })
  };
}

function assetName(
  asset: AssetArchiveAsset
): string {
  return new AssetPath(asset.path).name;
}

function rounded(
  vector: Vector3Like,
  factor = 1
): Vector3Like {
  return {
    x: round(vector.x * factor),
    y: round(vector.y * factor),
    z: round(vector.z * factor)
  };
}

function round(
  value: number
): number {
  return Math.round(value * 1000) / 1000 + 0;
}
