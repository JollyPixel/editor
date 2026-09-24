declare module "virtual:jolly-pixel/editors" {
  const editors: readonly import("./EditorDescriptor.ts").EditorDescriptor[];

  export default editors;
}
