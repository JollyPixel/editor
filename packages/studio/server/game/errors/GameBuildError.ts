export class GameBuildError extends Error {
  constructor(
    path: string,
    cause: Error
  ) {
    super(`"${path}" cannot be built: ${cause.message}`, { cause });
    this.name = "GameBuildError";
  }
}
