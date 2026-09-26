export class InvalidModelTreeError extends Error {
  readonly nodeId: string;

  constructor(
    nodeId: string,
    reason: string
  ) {
    super(`Invalid model tree: node ${nodeId} ${reason}.`);
    this.name = "InvalidModelTreeError";
    this.nodeId = nodeId;
  }
}
