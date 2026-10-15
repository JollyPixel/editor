export class TourDefinitionError extends Error {
  readonly tourId: string;
  readonly field: string;

  constructor(
    tourId: string,
    field: string,
    reason: string
  ) {
    super(`Tour "${tourId}": ${field} ${reason}`);

    this.name = "TourDefinitionError";
    this.tourId = tourId;
    this.field = field;
  }
}
