// Import Third-party Dependencies
import type { RuleTester } from "oxlint/plugins-dev";

export type Rule = Parameters<RuleTester["run"]>[1];
export type RuleContext = Parameters<NonNullable<Rule["create"]>>[0];
