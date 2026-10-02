declare module "virtual:jolly-pixel/project" {
  export const editors: readonly import("./editors/EditorDescriptor.ts").EditorDescriptor[];
  export const kinds: readonly import("@jolly-pixel/asset-server").AssetKindDescriptor[];
}

declare module "virtual:jolly-pixel/handlers" {
  export default function createHandlers(): import("@jolly-pixel/asset-server").AssetKindHandler[];
}
