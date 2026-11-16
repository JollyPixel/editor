// CONSTANTS
export const JOIN_MODES = [
  "request",
  "open",
  "invite"
] as const;

export type JoinMode = typeof JOIN_MODES[number];
