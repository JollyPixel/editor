// Import Third-party Dependencies
import { VOXEL_MAP_ASSET } from "@jolly-pixel/asset.voxel-map/client";
import {
  FormRows,
  type SceneComponentKind,
  type SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import {
  VoxelMapDefinition,
  type VoxelMapSettings
} from "@jolly-pixel/voxel.renderer/engine";

// Import Internal Dependencies
import { VoxelMapViewer } from "../viewer/VoxelMapViewer.ts";
import { SharedVoxelMaps } from "./SharedVoxelMaps.ts";
import "./componentIcons.ts";

// CONSTANTS
const kRows = new FormRows<VoxelMapSettings>();

const kVoxelMap: SceneComponentKind<VoxelMapSettings> = {
  definition: new VoxelMapDefinition(),
  label: "Voxel map",
  icon: "actor-voxel-map",
  form: () => [
    kRows.boolean(["castShadow"], "Cast shadow"),
    kRows.boolean(["receiveShadow"], "Receive shadow")
  ],
  anchorAsset: "map",
  origin: "corner"
};

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [kVoxelMap],
  presets: [
    {
      id: "voxel-map",
      label: "Voxel map",
      components: [
        {
          type: "VoxelMap",
          data: {}
        }
      ]
    }
  ],
  assets: [
    {
      descriptor: VOXEL_MAP_ASSET,
      documentKinds: VoxelMapViewer.kinds,
      open: (session) => new SharedVoxelMaps(
        (mapId) => new VoxelMapViewer({
          assets: session.assets,
          catalog: session.catalog,
          mapId
        })
      )
    }
  ]
};
