// Import Node.js Dependencies
import { readFileSync } from "node:fs";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { STORAGE_SCHEMA } from "../common/flags.ts";
import { EDIT_SCENARIOS } from "./Scenario.ts";
import { benchTargetsServedBy } from "../studio/BenchEditors.ts";
import {
  STUDIO_MODES,
  STUDIO_URL
} from "../studio/StudioPage.ts";

// CONSTANTS
export const EDIT_TARGETS = benchTargetsServedBy("script");
const kVariantSchema = z.object({
  label: z.string().min(1),
  storage: STORAGE_SCHEMA.default({}),
  base: z.url().default(STUDIO_URL)
});
export const EDIT_PLAN_SCHEMA = z.object({
  editors: z.array(z.string().min(1)).min(1).default(EDIT_TARGETS),
  modes: z.array(z.enum(STUDIO_MODES)).min(1).default(["offline"]),
  scenarios: z.array(z.enum(EDIT_SCENARIOS)).min(1).default([...EDIT_SCENARIOS]),
  variants: z.array(kVariantSchema).min(1)
});

export type EditPlan = z.infer<typeof EDIT_PLAN_SCHEMA>;
export type EditVariant = z.infer<typeof kVariantSchema>;

export function readEditPlan(
  file: string
): EditPlan {
  const plan = EDIT_PLAN_SCHEMA.safeParse(
    JSON.parse(readFileSync(file, "utf8"))
  );
  if (!plan.success) {
    throw new TypeError(`"${file}" is not a valid edit plan:\n${z.prettifyError(plan.error)}`);
  }

  return plan.data;
}
