declare module "virtual:jolly-pixel/handlers" {
  export default function createHandlers(): import("@jolly-pixel/asset-server").AnyAssetKindHandler[];
}

declare module "virtual:jolly-pixel/contributions/scene" {
  const contributions: readonly import("@jolly-pixel/editor.host/scene").SceneContribution[];
  export default contributions;
}

declare module "virtual:jolly-pixel/contributions/runtime" {
  const contributions: readonly import("./play/runtimeContributions.ts").RuntimeContribution[];
  export default contributions;
}

declare module "virtual:jolly-pixel/docs" {
  const books: readonly import("./shell/docs/DocsLibrary.ts").DocsBook[];
  export default books;
}
