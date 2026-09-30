export type ModelTreeEntry = "node" | "material";

export class InvalidModelTreeError extends Error {
  readonly entry: ModelTreeEntry;
  readonly id: string;

  constructor(
    entry: ModelTreeEntry,
    id: string,
    reason: string
  ) {
    super(`Invalid model tree: ${entry} ${id} ${reason}.`);
    this.name = "InvalidModelTreeError";
    this.entry = entry;
    this.id = id;
  }
}
