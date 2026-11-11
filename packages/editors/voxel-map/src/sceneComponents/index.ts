// Import Third-party Dependencies
import { VOXEL_MAP_ASSET } from "@jolly-pixel/asset.voxel-map/client";
import {
  FormRows,
  SharedSceneViewers,
  type SceneComponentKind,
  type SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";
import type {
  VoxelMapSettings,
  VoxelMapSource
} from "@jolly-pixel/voxel.renderer/engine";

// Import Internal Dependencies
import { VOXEL_MAP_DEFINITION } from "../runtime/index.ts";
import { VoxelMapViewer } from "../viewer/VoxelMapViewer.ts";

// CONSTANTS
const kRows = new FormRows<VoxelMapSettings>();

const kVoxelMap: SceneComponentKind<VoxelMapSettings> = {
  definition: VOXEL_MAP_DEFINITION,
  label: "Voxel map",
  category: "3d",
  form: () => [
    kRows.boolean(["castShadow"], "Cast shadow"),
    kRows.boolean(["receiveShadow"], "Receive shadow"),
    kRows.boolean(["collision"], "Collision")
  ],
  anchorAsset: "map",
  origin: "corner"
};

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [kVoxelMap],
  assets: [
    {
      descriptor: VOXEL_MAP_ASSET,
      documentKinds: VoxelMapViewer.kinds,
      open: (session) => new SharedSceneViewers({
        open: (mapId) => new VoxelMapViewer({
          assets: session.assets,
          catalog: session.catalog,
          mapId
        }),
        source: (viewer, hold): VoxelMapSource => {
          return {
            document: viewer.document,
            attach: (view) => hold(viewer.attach(view))
          };
        }
      })
    }
  ]
};
