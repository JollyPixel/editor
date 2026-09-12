export const PRESENCE_KEYS = {
  brush: "brush",
  block: "block",
  layer: "layer"
} as const;

export type PresenceKey = typeof PRESENCE_KEYS[keyof typeof PRESENCE_KEYS];
