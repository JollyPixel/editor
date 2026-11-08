declare module "virtual:jolly-pixel/handlers" {
  export default function createHandlers(): import("@jolly-pixel/asset-server").AnyAssetKindHandler[];
}

interface ImportMetaEnv {
  readonly PIXEL_ART_PLAYGROUND: boolean;
}
