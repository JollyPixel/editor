declare module "virtual:jolly-pixel/handlers" {
  export default function createHandlers(): import("@jolly-pixel/asset-server").AnyAssetKindHandler[];
}

declare module "virtual:jolly-pixel/contributions/scene" {
  const contributions: readonly {
    name: string;
    module: {
      SCENE_COMPONENTS?: import("@jolly-pixel/editor.host/scene").SceneComponentPackage;
    };
  }[];
  export default contributions;
}
