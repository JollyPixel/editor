// CONSTANTS
const kDefaultProfileLength = 16_384;
const kDefaultPresenceLength = 1_048_576;
const kDefaultResumeLength = 16_384;

export type LengthLimited = "profile" | "presence" | "resume";

export type LengthLimits = Readonly<Record<LengthLimited, number>>;

export interface RoomLimits {
  /**
   * Longest profile a member may hold, in JSON characters. A join past it
   * is refused, and a profile update past it is dropped.
   * @default 16_384
   */
  profileLength?: number;
  /**
   * Longest merged presence a member may hold, in JSON characters. A join
   * or presence update past it is refused.
   * @default 1_048_576
   */
  presenceLength?: number;
  /**
   * Longest resume a join may carry, in JSON characters. A join past it is
   * refused.
   * @default 16_384
   */
  resumeLength?: number;
  /**
   * Shortest interval, in milliseconds, between two resyncs of a member.
   * Requests inside it are coalesced into one resync at its end.
   * @default 1_000
   */
  resyncIntervalMs?: number;
}

export function lengthLimits(
  limits: RoomLimits = {}
): LengthLimits {
  return {
    profile: limits.profileLength ?? kDefaultProfileLength,
    presence: limits.presenceLength ?? kDefaultPresenceLength,
    resume: limits.resumeLength ?? kDefaultResumeLength
  };
}
