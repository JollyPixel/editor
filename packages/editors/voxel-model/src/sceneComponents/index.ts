// Import Third-party Dependencies
import { VOXEL_MODEL_ASSET } from "@jolly-pixel/asset.voxel-model/client";
import {
  FormRows,
  SharedSceneViewers,
  type SceneComponentKind,
  type SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";

// Import Internal Dependencies
import { VoxelModelViewer } from "../viewer/VoxelModelViewer.ts";
import type { VoxelModelSource } from "../viewer/VoxelModelSource.ts";
import {
  VoxelModelDefinition,
  type VoxelModelSettings
} from "./VoxelModelDefinition.ts";
import "./componentIcons.ts";

// CONSTANTS
const kRows = new FormRows<VoxelModelSettings>();

const kVoxelModel: SceneComponentKind<VoxelModelSettings> = {
  definition: new VoxelModelDefinition(),
  label: "Voxel model",
  icon: "actor-voxel-model",
  form: () => [
    kRows.boolean(["castShadow"], "Cast shadow"),
    kRows.boolean(["receiveShadow"], "Receive shadow")
  ]
};

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [kVoxelModel],
  presets: [
    {
      id: "voxel-model",
      label: "Voxel model",
      components: [
        {
          type: "VoxelModel",
          data: {}
        }
      ]
    }
  ],
  assets: [
    {
      descriptor: VOXEL_MODEL_ASSET,
      documentKinds: VoxelModelViewer.kinds,
      open: (session) => new SharedSceneViewers({
        open: (modelId) => new VoxelModelViewer({
          assets: session.assets,
          dependencies: session.catalog.dependencies,
          modelId
        }),
        source: (viewer, hold): VoxelModelSource => {
          return {
            document: viewer.document,
            texture: viewer.texture,
            attach: (view) => hold(viewer.attach(view))
          };
        }
      })
    }
  ]
};
