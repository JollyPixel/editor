declare module "virtual:jolly-pixel/editors" {
  const editors: readonly {
    name: string;
    kinds: readonly string[];
  }[];

  export default editors;
}
