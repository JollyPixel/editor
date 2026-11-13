// Import Third-party Dependencies
import type { Right } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { RoleRules } from "../RoleRules.ts";

// CONSTANTS
const kRank: Readonly<Record<Right, number>> = {
  void: 0,
  read: 1,
  write: 2
};

export const ALL_RIGHTS: readonly Right[] = ["void", "read", "write"];

export type ShownRight = Right | "mixed";

export interface PermissionRowInit {
  readonly label: string;
  readonly description?: string;
}

export interface PermissionRow {
  readonly id: string;
  readonly label: string;
  readonly description: string | undefined;
  readonly options: readonly Right[];
  readonly keys: readonly string[];
  rightIn(
    rules: RoleRules
  ): ShownRight;
  applyTo(
    rules: RoleRules,
    right: Right
  ): RoleRules;
  reachable(
    rules: RoleRules
  ): boolean;
}

export function lowerRight(
  left: Right,
  right: Right
): Right {
  return kRank[right] < kRank[left] ? right : left;
}

export function offeredUpTo(
  options: readonly Right[],
  right: Right
): Right {
  return options.reduce<Right>(
    (best, option) => (
      kRank[option] <= kRank[right] && kRank[option] > kRank[best] ?
        option :
        best
    ),
    "void"
  );
}
