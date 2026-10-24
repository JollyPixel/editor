// Import Third-party Dependencies
import type { RuleTester } from "oxlint/plugins-dev";

type OxlintRule = Parameters<RuleTester["run"]>[1];

export interface Rule extends Exclude<OxlintRule, { createOnce: unknown; }> {}
export type RuleContext = Parameters<Rule["create"]>[0];
