// CONSTANTS
const kDayMs = 24 * 60 * 60 * 1_000;
export const SHARE_LIFETIMES = ["1d", "7d", "30d", "never"] as const;

export type ShareLifetimeName = typeof SHARE_LIFETIMES[number];

const kDays: Record<ShareLifetimeName, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  never: null
};

export class ShareLifetime {
  static all(): ShareLifetime[] {
    return SHARE_LIFETIMES.map((name) => new ShareLifetime(name));
  }

  readonly name: ShareLifetimeName;

  constructor(
    name: ShareLifetimeName
  ) {
    this.name = name;
  }

  get label(): string {
    const days = kDays[this.name];
    if (days === null) {
      return "Never expires";
    }

    return days === 1 ? "1 day" : `${days} days`;
  }

  expiresAt(
    now: number
  ): number | null {
    const days = kDays[this.name];

    return days === null ? null : now + days * kDayMs;
  }
}
