export class UnknownStepError extends Error {
  readonly tourId: string;
  readonly stepId: string;

  constructor(
    tourId: string,
    stepId: string
  ) {
    super(`Tour "${tourId}" has no step "${stepId}"`);

    this.name = "UnknownStepError";
    this.tourId = tourId;
    this.stepId = stepId;
  }
}
