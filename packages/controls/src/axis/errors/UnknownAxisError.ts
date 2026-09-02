export class UnknownAxisError extends Error {
  readonly axis: string;

  constructor(
    axis: string
  ) {
    super(`No axis named "${axis}" is bound on this AxisMap.`);
    this.name = "UnknownAxisError";
    this.axis = axis;
  }
}
