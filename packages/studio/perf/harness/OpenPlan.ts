// Import Node.js Dependencies
import { readFileSync } from "node:fs";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { STUDIO_URL } from "./BenchEditors.ts";
import {
  FOLLOW_UP_PHASES,
  type FollowUpPhase
} from "./OpenRun.ts";
import {
  STUDIO_MODES,
  type StudioMode
} from "./StudioPage.ts";

// CONSTANTS
export const STORAGE_SCHEMA = z.record(z.string(), z.string());
export const MODES_SCHEMA = z.array(z.enum(STUDIO_MODES)).min(1);
export const PHASES_SCHEMA = z.array(z.enum(FOLLOW_UP_PHASES));
const kVariantSchema = z.object({
  label: z.string().min(1),
  storage: STORAGE_SCHEMA.default({}),
  prewarm: z.boolean().default(false),
  base: z.url().default(STUDIO_URL)
});
const kPlanSchema = z.object({
  editors: z.array(z.string().min(1)).min(1),
  modes: MODES_SCHEMA,
  phases: PHASES_SCHEMA.default([]),
  variants: z.array(kVariantSchema).min(1)
});

export type OpenVariant = z.infer<typeof kVariantSchema>;

export interface ScheduledVariant {
  round: number;
  variant: OpenVariant;
}

export class OpenPlan {
  readonly editors: readonly string[];
  readonly modes: readonly StudioMode[];
  readonly phases: ReadonlySet<FollowUpPhase>;
  readonly variants: readonly OpenVariant[];

  static read(
    file: string
  ): OpenPlan {
    const plan = kPlanSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!plan.success) {
      throw new TypeError(`"${file}" is not a valid plan:\n${z.prettifyError(plan.error)}`);
    }

    return new OpenPlan(plan.data);
  }

  constructor(
    data: z.infer<typeof kPlanSchema>
  ) {
    this.editors = [...data.editors];
    this.modes = [...data.modes];
    this.phases = new Set(data.phases);
    this.variants = [...data.variants];
  }

  * schedule(
    rounds: number
  ): IterableIterator<ScheduledVariant> {
    for (let round = 0; round < rounds; round++) {
      const variants = round % 2 === 0 ? this.variants : this.variants.toReversed();
      for (const variant of variants) {
        yield {
          round,
          variant
        };
      }
    }
  }
}
