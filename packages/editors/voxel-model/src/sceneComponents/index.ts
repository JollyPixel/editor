// Import Third-party Dependencies
import { VOXEL_MODEL_ASSET } from "@jolly-pixel/asset.voxel-model/client";
import {
  FormRows,
  SharedSceneViewers,
  type SceneComponentKind,
  type SceneComponentPackage
} from "@jolly-pixel/editor.host/scene";

// Import Internal Dependencies
import { VOXEL_MODEL_DEFINITION } from "../runtime/index.ts";
import { VoxelModelViewer } from "../viewer/VoxelModelViewer.ts";
import type { VoxelModelSource } from "../viewer/VoxelModelSource.ts";
import type { VoxelModelSettings } from "./VoxelModelDefinition.ts";

// CONSTANTS
const kRows = new FormRows<VoxelModelSettings>();

const kVoxelModel: SceneComponentKind<VoxelModelSettings> = {
  definition: VOXEL_MODEL_DEFINITION,
  label: "Voxel model",
  category: "3d",
  form: () => [
    kRows.boolean(["castShadow"], "Cast shadow"),
    kRows.boolean(["receiveShadow"], "Receive shadow")
  ]
};

export const SCENE_COMPONENTS: SceneComponentPackage = {
  components: [kVoxelModel],
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
