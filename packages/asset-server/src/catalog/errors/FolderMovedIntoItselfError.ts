export class FolderMovedIntoItselfError extends Error {
  readonly from: string;
  readonly to: string;

  constructor(
    from: string,
    to: string
  ) {
    super(`Folder "${from}" cannot move into itself at "${to}".`);
    this.name = "FolderMovedIntoItselfError";
    this.from = from;
    this.to = to;
  }
}
