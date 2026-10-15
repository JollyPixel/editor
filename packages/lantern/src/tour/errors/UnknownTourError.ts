export class UnknownTourError extends Error {
  readonly tourId: string;

  constructor(
    tourId: string
  ) {
    super(`No tour "${tourId}" is registered`);

    this.name = "UnknownTourError";
    this.tourId = tourId;
  }
}
