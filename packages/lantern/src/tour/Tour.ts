// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { TourDefinitionError } from "./errors/TourDefinitionError.ts";
import { TargetPath } from "./TargetPath.ts";
import type {
  StepEnter,
  StepTarget,
  StepUntil,
  TargetLocator,
  TourStep,
  TourStepOptions
} from "./TourStep.ts";

// CONSTANTS
const kTourId = /^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*$/;
const kNonBlank = z.string().check(
  z.refine((value) => value.trim() !== "", "must not be blank")
);
const kPositiveInteger = z.int("must be a positive integer").check(
  z.positive("must be a positive integer")
);
const kTargetSchema = z.pipe(
  z.union([
    z.array(kNonBlank).check(z.minLength(1, "must hold at least one selector")),
    z.custom<TargetLocator>(isFunction)
  ], { error: "must be a list of selectors or a function" }),
  z.transform((target): StepTarget => (typeof target === "function" ?
    target :
    new TargetPath(target)))
);
const kStepSchema = z.pipe(
  z.object({
    id: kNonBlank,
    title: kNonBlank,
    body: z.string(),
    image: z.optional(z.object({
      src: kNonBlank,
      alt: z.string(),
      width: z.optional(z.number()),
      height: z.optional(z.number())
    })),
    target: z.optional(kTargetSchema),
    side: z.optional(z.enum(["above", "below", "left", "right"])),
    enter: z.optional(z.custom<StepEnter>(isFunction, "must be a function")),
    until: z.optional(z.custom<StepUntil>(isFunction, "must be a function"))
  }),
  z.transform((step): TourStep => Object.freeze({
    id: step.id,
    title: step.title,
    body: step.body,
    image: step.image === undefined ? null : Object.freeze(step.image),
    target: step.target ?? null,
    side: step.side ?? "below",
    enter: step.enter ?? null,
    until: step.until ?? null
  }))
);
const kTourSchema = z.object({
  id: z.string().check(
    z.regex(kTourId, "must be a dotted identifier such as \"voxel-map.basics\"")
  ),
  version: kPositiveInteger,
  title: kNonBlank,
  steps: z.array(kStepSchema).check(
    z.minLength(1, "must hold at least one step"),
    z.check((context) => {
      const stepIds = new Set<string>();
      for (const [index, step] of context.value.entries()) {
        if (stepIds.has(step.id)) {
          context.issues.push({
            code: "custom",
            input: step.id,
            path: [index, "id"],
            message: `repeats "${step.id}"`
          });
        }
        stepIds.add(step.id);
      }
    })
  ),
  followUp: z.optional(
    z.custom<Tour>((value) => value instanceof Tour, "must be a Tour")
  )
});

export interface TourOptions {
  id: string;
  version: number;
  title: string;
  steps: readonly TourStepOptions[];
  followUp?: Tour;
}

export class Tour implements Iterable<TourStep> {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly steps: readonly TourStep[];
  readonly followUp: Tour | null;

  constructor(
    options: TourOptions
  ) {
    const parsed = kTourSchema.safeParse(options);
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      throw new TourDefinitionError(
        options.id,
        fieldPath(issue.path),
        issue.message
      );
    }

    this.id = parsed.data.id;
    this.version = parsed.data.version;
    this.title = parsed.data.title;
    this.steps = Object.freeze(parsed.data.steps);
    this.followUp = parsed.data.followUp ?? null;
  }

  stepIndex(
    stepId: string
  ): number {
    return this.steps.findIndex((step) => step.id === stepId);
  }

  * [Symbol.iterator](): IterableIterator<TourStep> {
    yield* this.steps;
  }
}

function isFunction(
  value: unknown
): boolean {
  return typeof value === "function";
}

function fieldPath(
  path: readonly PropertyKey[]
): string {
  return path.reduce<string>((field, key) => {
    if (typeof key === "number") {
      return `${field}[${key}]`;
    }

    return field === "" ? String(key) : `${field}.${String(key)}`;
  }, "");
}
