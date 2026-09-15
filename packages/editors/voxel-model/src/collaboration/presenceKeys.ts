export const PRESENCE_KEYS = {
  block: "block"
} as const;

export type PresenceKey = typeof PRESENCE_KEYS[keyof typeof PRESENCE_KEYS];
