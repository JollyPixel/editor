export const PRESENCE_KEYS = {
  block: "block",
  transformLive: "transformLive",
  transformLock: "transformLock"
} as const;

export type PresenceKey = typeof PRESENCE_KEYS[keyof typeof PRESENCE_KEYS];
