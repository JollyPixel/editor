export class MissingRouteParamError extends Error {
  constructor(
    path: string,
    name: string
  ) {
    super(`"${path}" needs a "${name}" param`);
    this.name = "MissingRouteParamError";
  }
}
