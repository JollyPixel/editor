// Import Internal Dependencies
import {
  Tour,
  type TourStepOptions
} from "#src/index.ts";

export function step(
  id: string,
  options: Partial<TourStepOptions> = {}
): TourStepOptions {
  return {
    id,
    title: id,
    body: "",
    ...options
  };
}

export function tour(
  steps: readonly TourStepOptions[] = [step("one"), step("two"), step("three")],
  options: { id?: string; version?: number; followUp?: Tour; } = {}
): Tour {
  return new Tour({
    id: options.id ?? "test.tour",
    version: options.version ?? 1,
    title: "Test tour",
    steps,
    followUp: options.followUp
  });
}
