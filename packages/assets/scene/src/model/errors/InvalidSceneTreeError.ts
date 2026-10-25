export type SceneTreeEntry = "actor" | "component";

export class InvalidSceneTreeError extends Error {
  readonly entry: SceneTreeEntry;
  readonly id: string;

  constructor(
    entry: SceneTreeEntry,
    id: string,
    reason: string
  ) {
    super(`Invalid scene tree: ${entry} ${id} ${reason}.`);
    this.name = "InvalidSceneTreeError";
    this.entry = entry;
    this.id = id;
  }
}
