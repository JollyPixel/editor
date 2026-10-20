// CONSTANTS
export const PATH_CONFLICT_POLICIES = ["reject", "suffix"] as const;

export type PathConflictPolicy = typeof PATH_CONFLICT_POLICIES[number];
