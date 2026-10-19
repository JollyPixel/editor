// Import Node.js Dependencies
import { readFileSync } from "node:fs";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { STORAGE_SCHEMA } from "./flags.ts";
import { PHASES } from "./OpenSample.ts";
import {
  STUDIO_MODES,
  STUDIO_URL,
  type StudioMode
} from "./StudioPage.ts";

// CONSTANTS
export const FOLLOW_UP_PHASE = z.enum(PHASES).exclude(["first"]);
const kVariantSchema = z.object({
  label: z.string().min(1),
  storage: STORAGE_SCHEMA.default({}),
  prefetch: z.boolean().default(false),
  prewarm: z.boolean().default(false),
  base: z.url().default(STUDIO_URL)
});
const kPlanSchema = z.object({
  editors: z.array(z.string().min(1)).min(1),
  modes: z.array(z.enum(STUDIO_MODES)).min(1),
  phases: z.array(FOLLOW_UP_PHASE).default([]),
  variants: z.array(kVariantSchema).min(1)
});

export type FollowUpPhase = z.infer<typeof FOLLOW_UP_PHASE>;
export type OpenVariant = z.infer<typeof kVariantSchema>;

export class OpenPlan {
  readonly editors: readonly string[];
  readonly modes: readonly StudioMode[];
  readonly phases: ReadonlySet<FollowUpPhase>;
  readonly variants: readonly OpenVariant[];

  static read(
    file: string
  ): OpenPlan {
    return OpenPlan.parse(
      JSON.parse(readFileSync(file, "utf8")),
      `"${file}"`
    );
  }

  static parse(
    input: unknown,
    source: string
  ): OpenPlan {
    const plan = kPlanSchema.safeParse(input);
    if (!plan.success) {
      throw new TypeError(`${source} is not a valid plan:\n${z.prettifyError(plan.error)}`);
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
}
